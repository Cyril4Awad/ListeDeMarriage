using DataService.Others;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Main.Infrastructure
{
    /// <summary>Turns engine exceptions into a status code and { error } body.</summary>
    public class GlobalExceptionFilter : IExceptionFilter
    {
        private readonly ILogger<GlobalExceptionFilter> _logger;

        public GlobalExceptionFilter(ILogger<GlobalExceptionFilter> logger) => _logger = logger;

        public void OnException(ExceptionContext context)
        {
            var (status, message) = context.Exception switch
            {
                NotFoundException e => (StatusCodes.Status404NotFound, e.Message),
                ValidationException e => (StatusCodes.Status400BadRequest, e.Message),
                UnauthorizedException e => (StatusCodes.Status401Unauthorized, e.Message),
                _ => (StatusCodes.Status500InternalServerError, "Something went wrong. Please try again."),
            };

            if (status == StatusCodes.Status500InternalServerError)
                _logger.LogError(context.Exception, "Unhandled error on {Path}", context.HttpContext.Request.Path);

            context.Result = new ObjectResult(new { error = message }) { StatusCode = status };
            context.ExceptionHandled = true;
        }
    }
}
