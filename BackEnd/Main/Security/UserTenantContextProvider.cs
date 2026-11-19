using DataService.Others;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Main.Security
{
    /// <summary>
    /// Reads the logged-in client from the validated token. The client is never taken
    /// from the request body or query, so a couple can only ever read their own list.
    /// </summary>
    public class UserTenantContextProvider
    {
        private readonly IHttpContextAccessor _contextAccessor;
        private UserTenantContext? _context;

        public UserTenantContextProvider(IHttpContextAccessor contextAccessor)
        {
            _contextAccessor = contextAccessor;
        }

        public UserTenantContext GetCurrentContextAsync()
        {
            if (_context != null)
                return _context;

            var user = _contextAccessor.HttpContext?.User;
            var subject = user?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                       ?? user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrWhiteSpace(subject)
                || !decimal.TryParse(subject, NumberStyles.Number, CultureInfo.InvariantCulture, out var recId))
                throw new UnauthorizedException("Your session has ended. Please sign in again.");

            _context = new UserTenantContext { User_Code = subject, ClientRecId = recId };
            return _context;
        }
    }
}
