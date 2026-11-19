using DataService.DataAccess;
using DataService.Models;
using DataService.Others;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace DataService.Engines.Authentication
{
    public class AuthenticationEngine
    {
        /// <summary>Separates the client code from the client number in the login: "3008/0".</summary>
        public const char LoginSeparator = '/';

        private readonly JwtSettings _jwt;
        private readonly WeddingDAL _dal;

        public AuthenticationEngine(IOptions<JwtSettings> jwt, WeddingDAL dal)
        {
            _jwt = jwt.Value;
            _dal = dal;
        }

        /// <summary>
        /// The couple logs in with "code/no" as both username and password (e.g. 3008/0).
        /// Returns a token whose subject is the client's CL_RecID.
        /// </summary>
        public async Task<LoginResponse> Login(LoginRequest request)
        {
            var username = (request.Username ?? string.Empty).Trim();
            var password = (request.Password ?? string.Empty).Trim();

            if (username.Length == 0 || username != password || !TryParseLogin(username, out var code, out var no))
                throw new UnauthorizedException("Invalid code or password.");

            var client = await _dal.GetClientByCode(code, no)
                ?? throw new UnauthorizedException("Invalid code or password.");

            return new LoginResponse
            {
                AccessToken = GenerateJWT(client.RecId.ToString(CultureInfo.InvariantCulture)),
                ExpiresIn = _jwt.LifetimeMinutes * 60,
                ClientName = client.Name?.Trim() ?? string.Empty,
            };
        }

        /// <summary>
        /// Signs a token for this subject (the client's CL_RecID). Also called by
        /// TokenRefreshMiddleware on every authenticated request to slide the session.
        /// </summary>
        public string GenerateJWT(string subject)
        {
            var now = DateTime.UtcNow;
            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, subject),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(JwtRegisteredClaimNames.Iat, EpochTime.GetIntDate(now).ToString(CultureInfo.InvariantCulture), ClaimValueTypes.Integer64),
            };

            var jwt = new JwtSecurityToken(
                issuer: _jwt.Issuer,
                audience: _jwt.Audience,
                claims: claims,
                notBefore: now,
                expires: now.AddMinutes(_jwt.LifetimeMinutes),
                signingCredentials: new SigningCredentials(SigningKey(_jwt), SecurityAlgorithms.HmacSha256));

            return new JwtSecurityTokenHandler().WriteToken(jwt);
        }

        /// <summary>Shared by token signing (here) and token validation (Main/Program.cs).</summary>
        public static SymmetricSecurityKey SigningKey(JwtSettings jwt) => new(Encoding.UTF8.GetBytes(jwt.Key));

        private static bool TryParseLogin(string value, out decimal code, out short no)
        {
            code = 0;
            no = 0;
            var parts = value.Split(LoginSeparator);
            return parts.Length == 2
                && decimal.TryParse(parts[0].Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out code)
                && short.TryParse(parts[1].Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out no);
        }
    }
}
