using DataService.Engines.Authentication;
using DataService.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Main.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [AllowAnonymous]
    public class AuthController : ControllerBase
    {
        private readonly AuthenticationEngine _engine;

        public AuthController(AuthenticationEngine engine) => _engine = engine;

        /// <summary>POST /api/auth/login  { "username": "3008/0", "password": "3008/0" }</summary>
        [HttpPost("login")]
        [EnableRateLimiting("login")]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
            => Ok(await _engine.Login(request));
    }
}
