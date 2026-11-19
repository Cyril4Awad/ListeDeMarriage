using DataService.DataAccess;
using DataService.Models;
using DataService.Others;
using Microsoft.Extensions.Options;

namespace DataService.Engines.Wedding
{
    public class WeddingEngine
    {
        private readonly WeddingDAL _dal;
        private readonly WeddingSettings _settings;

        public WeddingEngine(WeddingDAL dal, IOptions<WeddingSettings> settings)
        {
            _dal = dal;
            _settings = settings.Value;
        }

        /// <summary>The couple and every gift received, for the logged-in client.</summary>
        public async Task<WeddingList> GetWeddingList(decimal clientRecId)
        {
            var couple = await _dal.GetCouple(clientRecId, _settings.AccountCompany?.Trim() ?? string.Empty)
                ?? throw new NotFoundException("This wedding list no longer exists.");

            couple.Name = couple.Name.Trim();
            couple.Remark = string.IsNullOrWhiteSpace(couple.Remark) ? null : couple.Remark.Trim();

            return new WeddingList
            {
                Couple = couple,
                Gifts = await _dal.GetGifts(clientRecId, _settings.RateApplication?.Trim() ?? "POSO", _settings.RateCompany?.Trim() ?? "02"),
            };
        }
    }
}
