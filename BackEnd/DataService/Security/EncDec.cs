using System.Security.Cryptography;
using System.Text;

namespace DataService.Security
{
    /// <summary>
    /// Decrypts the connection string. Same algorithm as the other services, so a
    /// string encrypted with the usual tool can be pasted into appsettings as is.
    /// </summary>
    public static class EncDec
    {
        private const string InitVector = "REDACTED";
        private const int KeySize = 256;

        static EncDec()
        {
            // windows-1252 / windows-1256 are not built into .NET 8 until this is registered.
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        }

        public static string DecryptConnectionString(string cipherText)
        {
            return DecryptString(cipherText, DecPS("ju" + (char)128 + "zz{j"));
        }

        public static string DecPS(string spwd1)
        {
            string result = "";
            int lp = spwd1.Length;

            for (int i = 1; i <= lp; i++)
            {
                char rightChar = spwd1[spwd1.Length - i];
                char decodedChar = (char)(rightChar - lp);

                byte[] bytes = Encoding.GetEncoding("windows-1252").GetBytes(decodedChar.ToString());
                result += Encoding.GetEncoding("windows-1256").GetString(bytes);
            }

            return result;
        }

        public static string DecryptString(string cipherText, string passPhrase)
        {
            try
            {
                byte[] initVectorBytes = Encoding.UTF8.GetBytes(InitVector);
                byte[] cipherTextBytes = Convert.FromBase64String(cipherText);

#pragma warning disable SYSLIB0041, CS0618 // kept identical to the encrypting tool
                var password = REDACTED PasswordDeriveBytes(passPhrase, null);
                byte[] keyBytes = password.GetBytes(KeySize / 8);
#pragma warning restore SYSLIB0041, CS0618

                using var symmetricKey = Aes.Create();
                symmetricKey.Mode = CipherMode.CBC;
                symmetricKey.Padding = PaddingMode.PKCS7;

                using var decryptor = symmetricKey.CreateDecryptor(keyBytes, initVectorBytes);
                using var memoryStream = new MemoryStream(cipherTextBytes);
                using var cryptoStream = new CryptoStream(memoryStream, decryptor, CryptoStreamMode.Read);
                using var reader = new StreamReader(cryptoStream, Encoding.UTF8);
                return reader.ReadToEnd();
            }
            catch (Exception ex)
            {
                // Fail loudly: an empty connection string would only show up later as a confusing SQL error.
                throw new InvalidOperationException(
                    "ConnectionStrings:Constr in appsettings.json could not be decrypted. Check that it was encrypted with the tool and pasted in full.", ex);
            }
        }
    }
}
