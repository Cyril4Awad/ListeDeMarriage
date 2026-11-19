namespace Main.Security
{
    /// <summary>The logged-in couple, read from the token.</summary>
    public class UserTenantContext
    {
        /// <summary>The token subject: the client's CL_RecID, as text.</summary>
        public string User_Code { get; set; } = string.Empty;

        /// <summary>CL_RecID as a number, for the queries.</summary>
        public decimal ClientRecId { get; set; }
    }
}
