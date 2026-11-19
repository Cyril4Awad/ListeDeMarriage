using DataService.DataAccess;
using DataService.Engines.Authentication;
using DataService.Engines.Wedding;
using DataService.Models;
using DataService.Security;
using Main.Infrastructure;
using Main.Middleware;
using Main.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// ---------- settings ----------
var jwt = builder.Configuration.GetSection("Jwt").Get<JwtSettings>()
          ?? throw new InvalidOperationException("The Jwt section is missing from appsettings.");
if (string.IsNullOrWhiteSpace(jwt.Key) || jwt.Key.Length < 32)
    throw new InvalidOperationException("Jwt:Key must be at least 32 characters.");

builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<WeddingSettings>(builder.Configuration.GetSection("Wedding"));

// ---------- CORS ----------
// "_auth" carries the refreshed token (TokenRefreshMiddleware); the browser can only read it if exposed.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        if (allowedOrigins.Length > 0) policy.WithOrigins(allowedOrigins);
        else policy.AllowAnyOrigin();
        policy.AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("_auth");
    });
});

// ---------- authentication ----------
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.MapInboundClaims = false; // keep "sub" as "sub"
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = AuthenticationEngine.SigningKey(jwt),
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateLifetime = true,
            RequireExpirationTime = true,
            ClockSkew = TimeSpan.Zero,
        };
    });
builder.Services.AddAuthorization();

// ---------- sign-in rate limit ----------
// Logins are short numbers ("3008/0"), so stop anyone trying them one after another:
// 10 attempts per minute per address, then "Too many attempts" until the minute is up.
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("login", http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (ctx, token) =>
        new ValueTask(ctx.HttpContext.Response.WriteAsJsonAsync(
            new { error = "Too many attempts. Please wait a minute and try again." }, token));
});

// ---------- services ----------
builder.Services.AddControllers(options => options.Filters.Add<GlobalExceptionFilter>());
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();

// Decrypted once at startup (if encrypted), then shared.
builder.Services.AddSingleton<ConnectionStringProvider>();
builder.Services.AddScoped<UserTenantContextProvider>();
builder.Services.AddScoped<WeddingDAL>();
builder.Services.AddScoped<AuthenticationEngine>();
builder.Services.AddScoped<WeddingEngine>();

var app = builder.Build();

// Read (and decrypt) the connection string now, so a bad value stops the API at startup with a clear error.
_ = app.Services.GetRequiredService<ConnectionStringProvider>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.UseAuthentication();
app.UseMiddleware<TokenRefreshMiddleware>(); // sliding 60-minute session
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

app.Run();
