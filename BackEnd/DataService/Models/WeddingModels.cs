namespace DataService.Models
{
    /// <summary>Settings from the "Jwt" section of appsettings.</summary>
    public class JwtSettings
    {
        public string Key { get; set; } = string.Empty;
        public string Issuer { get; set; } = string.Empty;
        public string Audience { get; set; } = string.Empty;
        /// <summary>Idle time before the session ends. Every authenticated request resets it.</summary>
        public int LifetimeMinutes { get; set; } = 60;
    }

    /// <summary>Settings from the "Wedding" section of appsettings.</summary>
    public class WeddingSettings
    {
        /// <summary>
        /// STk04_ClAccounts.CA_Comp to read the couple's account from (e.g. "02").
        /// Leave empty to take the first account found for the client.
        /// </summary>
        public string AccountCompany { get; set; } = string.Empty;

        /// <summary>Application code passed to dbo.convert5 to turn LBP (or other) receipts into USD. The POS uses "POSO".</summary>
        public string RateApplication { get; set; } = "POSO";

        /// <summary>Company passed to dbo.convert5 (e.g. "02").</summary>
        public string RateCompany { get; set; } = "02";
    }

    /// <summary>Body of POST /api/auth/login. Both fields are "code/no", e.g. "3008/0".</summary>
    public class LoginRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class LoginResponse
    {
        public string AccessToken { get; set; } = string.Empty;
        public int ExpiresIn { get; set; }
        public string ClientName { get; set; } = string.Empty;
    }

    /// <summary>A row of Stk04_Clients, as much of it as the wedding list needs.</summary>
    public class WeddingClient
    {
        public decimal RecId { get; set; }
        public decimal Code { get; set; }
        public short No { get; set; }
        public string? Name { get; set; }
        public int? FolioNo { get; set; }
        public short? FolioSubNo { get; set; }
    }

    /// <summary>The couple: Stk04_Clients + Com_Folio remark + STk04_ClAccounts.</summary>
    public class Couple
    {
        /// <summary>CL_Name, e.g. "Maya and Karim".</summary>
        public string Name { get; set; } = string.Empty;
        /// <summary>Com_Folio.Fo_remark, shown as written, e.g. "Wedding On 24 December".</summary>
        public string? Remark { get; set; }
        /// <summary>Last 4 digits of the account number (first 11 characters of CA_CLAc).</summary>
        public string? AccountEnding { get; set; }
    }

    /// <summary>One gift: POS_RCListDeMariage joined to its RC receipt in POS_SALEINVHEAD.</summary>
    public class Gift
    {
        /// <summary>"{location}-{receipt recid}", unique across branches.</summary>
        public string Id { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        /// <summary>INVH_DOCPREFIX + INVH_SERNO, e.g. "C918".</summary>
        public string ReceiptNo { get; set; } = string.Empty;
        public string From { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        /// <summary>INVH_DATE as yyyy-MM-dd.</summary>
        public string Date { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Currency { get; set; } = string.Empty;
    }

    public class WeddingList
    {
        public Couple Couple { get; set; } = new();
        public List<Gift> Gifts { get; set; } = new();
    }
}
