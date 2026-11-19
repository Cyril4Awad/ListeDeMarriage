using DataService.Engines.Wedding;
using DataService.Models;
using Main.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Main.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class WeddingController : ControllerBase
    {
        private readonly WeddingEngine _engine;
        private readonly UserTenantContextProvider _users;

        public WeddingController(WeddingEngine engine, UserTenantContextProvider users)
        {
            _engine = engine;
            _users = users;
        }

        /// <summary>GET /api/wedding: the couple and every gift, for the client in the token.</summary>
        [HttpGet]
        public async Task<ActionResult<WeddingList>> Get()
            => Ok(await _engine.GetWeddingList(_users.GetCurrentContextAsync().ClientRecId));
    }
}
