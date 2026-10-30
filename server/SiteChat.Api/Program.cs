using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using SiteChat.Api;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 32768);
builder.Services.Configure<SiteChatOptions>(builder.Configuration.GetSection("SiteChat"));
builder.Services.AddHttpClient<IChatResponder, ChatResponder>(client => client.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddCors(options =>
{
    var sites = builder.Configuration.GetSection("SiteChat").Get<SiteChatOptions>() ?? new();
    options.AddDefaultPolicy(policy => policy
        .SetIsOriginAllowed(origin => sites.Sites.Values.Any(site => OriginPolicy.IsAllowed(origin, site)))
        .WithMethods("POST").WithHeaders("Content-Type").SetPreflightMaxAge(TimeSpan.FromMinutes(10)));
});
builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        context.Request.Path != "/api/chat" ? RateLimitPartition.GetNoLimiter("static") :
        RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(5), QueueLimit = 0 }));
    options.AddConcurrencyLimiter("chat", options => { options.PermitLimit = 16; options.QueueLimit = 0; });
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = 429;
        context.HttpContext.Response.Headers.RetryAfter = "300";
        await context.HttpContext.Response.WriteAsJsonAsync(new { error = new ApiError("rate_limited", "Too many requests. Please wait and try again.") }, token);
    };
});
var app = builder.Build();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    if (context.Request.Path.StartsWithSegments("/api")) context.Response.Headers.CacheControl = "no-store";
    await next(context);
});
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = context =>
    {
        // Public, credential-free embed assets. Fonts need CORS on other websites.
        context.Context.Response.Headers["Access-Control-Allow-Origin"] = "*";
        context.Context.Response.Headers["Cross-Origin-Resource-Policy"] = "cross-origin";
        context.Context.Response.Headers.CacheControl = "public,max-age=3600";
    }
});
app.UseCors();
app.UseRateLimiter();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapPost("/api/chat", async (HttpContext context, IOptions<SiteChatOptions> options, IChatResponder responder, ILogger<Program> logger) =>
{
    static IResult Error(int status, string code, string message) => Results.Json(new { error = new ApiError(code, message) }, statusCode: status);
    if (!context.Request.HasJsonContentType()) return Error(415, "content_type", "Use application/json.");
    if (context.Request.ContentLength > 32768) return Error(413, "payload_too_large", "Request exceeds 32 KiB.");
    ChatRequest? request;
    try { request = await context.Request.ReadFromJsonAsync<ChatRequest>(context.RequestAborted); }
    catch (JsonException) { return Error(400, "invalid_json", "The request is not valid JSON."); }
    catch (BadHttpRequestException exception) { return Error(exception.StatusCode, "invalid_request", "The request could not be read."); }
    var validation = ChatValidation.Validate(request);
    if (validation is not null) return Error(400, "validation", validation);
    if (!options.Value.Sites.TryGetValue(request!.SiteId, out var site)) return Error(404, "unknown_site", "Unknown siteId.");
    if (!OriginPolicy.IsAllowed(context.Request.Headers.Origin.ToString(), site))
        return Error(403, "origin_not_allowed", "This website origin is not allowlisted for this bot.");
    try
    {
        var reply = await responder.ReplyAsync(site, request.Messages, context.RequestAborted);
        return Results.Ok(new { reply });
    }
    catch (ProviderUnavailableException) { return Error(503, "not_configured", "The AI service is not configured. Contact the website owner."); }
    catch (OperationCanceledException) when (!context.RequestAborted.IsCancellationRequested)
    { return Error(504, "ai_timeout", "The AI service took too long. Please try again."); }
    catch (OperationCanceledException) { return Error(499, "cancelled", "The request was cancelled."); }
    catch (Exception exception) when (exception is HttpRequestException or JsonException or InvalidOperationException)
    {
        // Never log conversation text, provider bodies, credentials or private prompts.
        logger.LogWarning("AI request failed: {ExceptionType}", exception.GetType().Name);
        return Error(502, "ai_unavailable", "The AI service is temporarily unavailable. Please try again.");
    }
}).RequireRateLimiting("chat");
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port)) app.Urls.Add($"http://0.0.0.0:{port}");
app.Run();
public partial class Program { }
