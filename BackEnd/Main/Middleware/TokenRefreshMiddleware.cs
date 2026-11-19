using DataService.Engines.Authentication;
using Main.Security;

namespace Main.Middleware
{
    /// <summary>
    /// Sliding session: every authenticated request gets a fresh token in the "_auth" response
    /// header ("Bearer ..."), which the frontend stores (updateTokenFromResponse). A user who
    /// stays inactive longer than the token lifetime gets a 401 and the session-expired dialog.
    /// </summary>
    public class TokenRefreshMiddleware
    {
        private readonly RequestDelegate _next;

        public TokenRefreshMiddleware(RequestDelegate next) => _next = next;

        public async Task InvokeAsync(HttpContext context, AuthenticationEngine authenticationEngine, UserTenantContextProvider users)
        {
            // Services come from the request scope (scoped per request, disposed with it).
            if (context.User?.Identity?.IsAuthenticated == true
                && context.Request.Headers.Authorization.ToString().StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                var newToken = authenticationEngine.GenerateJWT(users.GetCurrentContextAsync().User_Code);
                if (!string.IsNullOrEmpty(newToken))
                    context.Response.Headers["_auth"] = "Bearer " + newToken;
            }
            await _next(context);
        }
    }
}
