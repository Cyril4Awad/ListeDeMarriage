using Microsoft.Extensions.Configuration;

namespace DataService.Security
{
    /// <summary>
    /// Gives the DAL the database connection string. ConnectionStrings:Constr in appsettings.json
    /// may be plain ("Data Source=SERVER;Initial Catalog=DATABASE;User ID=USER;Password=PASSWORD") or encrypted with the tool: a plain one always
    /// contains ";", an encrypted one (Base64) never does, so no extra setting is needed.
    /// </summary>
    public class ConnectionStringProvider
    {
        public string ConnectionString { get; }

        public ConnectionStringProvider(IConfiguration configuration)
        {
            var value = configuration.GetConnectionString("Constr")?.Trim();
            if (string.IsNullOrEmpty(value))
                throw new InvalidOperationException("ConnectionStrings:Constr is missing from appsettings.json.");

            ConnectionString = IsEncrypted(value) ? EncDec.DecryptConnectionString(value) : value;
        }

        public static bool IsEncrypted(string value) => !value.Contains(';');
    }
}
