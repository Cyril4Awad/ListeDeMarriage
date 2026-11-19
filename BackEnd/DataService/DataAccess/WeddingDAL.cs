using Dapper;
using DataService.Models;
using DataService.Security;
using Microsoft.Data.SqlClient;

namespace DataService.DataAccess
{
    public class WeddingDAL
    {
        private readonly string _connectionString;

        public WeddingDAL(ConnectionStringProvider connection)
        {
            _connectionString = connection.ConnectionString;
        }

        private SqlConnection Open() => new SqlConnection(_connectionString);

        /// <summary>The active client with this code and number, or null.</summary>
        public async Task<WeddingClient?> GetClientByCode(decimal code, short no)
        {
            const string sql = @"
                SELECT TOP (1)
                    CL_RecID      AS RecId,
                    CL_Code       AS Code,
                    CL_No         AS No,
                    CL_Name       AS Name,
                    CL_FolioNo    AS FolioNo,
                    CL_FolioSubNo AS FolioSubNo
                FROM dbo.Stk04_Clients
                WHERE CL_Code = @code AND CL_No = @no AND CL_Active = 'Y';";

            await using var cn = Open();
            return await cn.QueryFirstOrDefaultAsync<WeddingClient>(sql, new { code, no });
        }

        /// <summary>
        /// The couple's name, folio remark and account. accountCompany filters STk04_ClAccounts.CA_Comp;
        /// when it is empty, the first account found is used.
        /// </summary>
        public async Task<Couple?> GetCouple(decimal clientRecId, string accountCompany)
        {
            const string sql = @"
                SELECT
                    ISNULL(c.CL_Name, '') AS Name,
                    f.Fo_remark           AS Remark,
                    a.Account             AS AccountEnding
                FROM dbo.Stk04_Clients c
                LEFT JOIN dbo.Com_Folio f
                       ON f.Fo_serno = c.CL_FolioNo
                      AND f.Fo_subno = c.CL_FolioSubNo
                OUTER APPLY (
                    -- CA_CLAc is the account number with the currency appended: keep the first 11 characters.
                    SELECT TOP (1) RIGHT(LEFT(RTRIM(ca.CA_CLAc), 11), 4) AS Account
                    FROM dbo.STk04_ClAccounts ca
                    WHERE ca.CA_CLRecid = c.CL_RecID
                      AND ca.CA_CLAc IS NOT NULL
                      AND (@comp = '' OR ca.CA_Comp = @comp)
                    ORDER BY ca.CA_Comp
                ) a
                WHERE c.CL_RecID = @clientRecId;";

            await using var cn = Open();
            return await cn.QueryFirstOrDefaultAsync<Couple>(sql, new { clientRecId, comp = accountCompany ?? string.Empty });
        }

        /// <summary>
        /// Every gift made for this client, in any branch: wedding-list rows whose RC receipt
        /// (same location + recid) was issued to the client. Amounts are always in USD: a receipt
        /// saved in LBP (or any other currency) is converted with dbo.convert5 at its own date,
        /// the same function the POS uses. If that day has no rate in Com_DailyRate (convert5
        /// then returns 0), the rate stored on the receipt itself (INVH_RATE) is used instead.
        /// </summary>
        public async Task<List<Gift>> GetGifts(decimal clientRecId, string rateApp, string rateCompany)
        {
            const string sql = @"
                SELECT
                    CONCAT(RTRIM(r.RLM_Location), '-', CAST(r.RLM_InvRecId AS bigint))      AS Id,
                    RTRIM(v.Loc_Desc)                                                   AS Location,
                    CONCAT(RTRIM(h.INVH_DOCTYP1), RTRIM(h.INVH_DOCPREFIX), CAST(h.INVH_SERNO AS bigint))           AS ReceiptNo,
                    LTRIM(RTRIM(r.RLM_From))                                                AS [From],
                    LTRIM(RTRIM(ISNULL(r.RLM_Message, '')))                                 AS Message,
                    CONVERT(char(10), h.INVH_DATE, 23)                                      AS [Date],
                    CASE
                        WHEN usd.Converted <> 0 OR ISNULL(h.INVH_NET, 0) = 0 THEN usd.Converted
                        WHEN ISNULL(h.INVH_RATE, 0) > 0 THEN ROUND(h.INVH_NET / h.INVH_RATE, 3)
                        ELSE 0
                    END                                                                     AS Amount,
                    'USD'                                                                   AS Currency
                FROM dbo.POS_RCListDeMariage r
                JOIN dbo.POS_SALEINVHEAD h
                  ON h.INVH_LOC   = r.RLM_Location
                 AND h.INVH_RECID = r.RLM_InvRecId
                CROSS APPLY (
                    SELECT CASE
                               WHEN ISNULL(NULLIF(RTRIM(h.INVH_CURR), ''), 'USD') = 'USD' THEN ISNULL(h.INVH_NET, 0)
                               ELSE ISNULL(dbo.convert5(@rateApp, @rateCompany, YEAR(h.INVH_DATE), ISNULL(h.INVH_NET, 0),
                                                        RTRIM(h.INVH_CURR), 'USD', h.INVH_DATE), 0)
                           END AS Converted
                ) usd
                JOIN dbo.V_spLocation v
                   ON v.SL_Loc = RLM_Location
                WHERE h.INVH_DOCTYP1  = 'RC'
                  AND h.INVH_CLIENTSUP = @clientRecId
                ORDER BY h.INVH_DATE DESC, r.RLM_CrDStmp DESC;";

            await using var cn = Open();
            return (await cn.QueryAsync<Gift>(sql, new { clientRecId, rateApp, rateCompany })).ToList();
        }
    }
}
