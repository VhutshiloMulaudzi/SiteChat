using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using SiteChat.Api;

namespace SiteChat.Tests;

public class ProviderTests
{
    private sealed class Handler(string json, HttpStatusCode status = HttpStatusCode.OK) : HttpMessageHandler
    {
        public string? Body { get; private set; }
        public Uri? Url { get; private set; }
        public string? Authorization { get; private set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            Url = request.RequestUri; Authorization = request.Headers.Authorization?.ToString();
            Body = await request.Content!.ReadAsStringAsync(token);
            return new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
        }
    }
    private static IConfiguration Config(bool managed = false) => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    {
        [managed ? "MANUS_API_URL" : "AI_BASE_URL"] = managed ? "https://managed.example" : "https://provider.example/v1",
        [managed ? "MANUS_API_KEY" : "AI_API_KEY"] = "dummy-test-token",
        ["AI_MODEL"] = "test-model"
    }).Build();
    private static Task<string> Reply(Handler handler, bool managed = false) => new ChatResponder(new HttpClient(handler), Config(managed)).ReplyAsync(new() { SystemPrompt = "Trusted instructions" }, [new("user", "Hello")], CancellationToken.None);
    [Fact] public async Task IndependentProviderUsesV1AndServerPrompt()
    {
        var handler = new Handler("{\"choices\":[{\"message\":{\"content\":\"Hello visitor\"}}]}");
        Assert.Equal("Hello visitor", await Reply(handler));
        Assert.Equal("https://provider.example/v1/chat/completions", handler.Url?.ToString());
        Assert.Equal("Bearer dummy-test-token", handler.Authorization);
        using var body = JsonDocument.Parse(handler.Body!); Assert.Equal("system", body.RootElement.GetProperty("messages")[0].GetProperty("role").GetString());
        Assert.Equal("Trusted instructions", body.RootElement.GetProperty("messages")[0].GetProperty("content").GetString());
        Assert.False(body.RootElement.TryGetProperty("reasoning", out _));
    }
    [Fact] public async Task ManagedProviderUsesCorrectPathAndLowEffort()
    {
        var handler = new Handler("{\"choices\":[{\"message\":{\"content\":\"Hi\"}}]}"); await Reply(handler, true);
        Assert.Equal("https://managed.example/v1/chat/completions", handler.Url?.ToString());
        using var body = JsonDocument.Parse(handler.Body!); Assert.Equal("low", body.RootElement.GetProperty("reasoning").GetProperty("effort").GetString());
    }
    [Theory]
    [InlineData("{\"error\":{\"message\":\"failed\"}}")]
    [InlineData("{\"choices\":[]}")]
    [InlineData("{\"choices\":[{\"message\":{\"content\":null}}]}")]
    [InlineData("{\"choices\":[{\"message\":{\"content\":\"\"}}]}")]
    public async Task UnusableProviderResponseIsFailure(string json) => await Assert.ThrowsAsync<HttpRequestException>(() => Reply(new(json)));
    [Fact] public async Task HttpFailureIsNotAReply() => await Assert.ThrowsAsync<HttpRequestException>(() => Reply(new("{}", HttpStatusCode.TooManyRequests)));
    [Fact] public async Task ReplyFitsFutureRequestLimit()
    {
        var json = JsonSerializer.Serialize(new { choices = new[] { new { message = new { content = new string('a', 2400) } } } });
        Assert.Equal(ChatValidation.MaxMessageLength, (await Reply(new(json))).Length);
    }
    [Fact] public async Task MissingConfigurationFailsBeforeNetwork()
    {
        var handler = new Handler("{}"); var responder = new ChatResponder(new HttpClient(handler), new ConfigurationBuilder().Build());
        await Assert.ThrowsAsync<ProviderUnavailableException>(() => responder.ReplyAsync(new(), [new("user", "Hi")], CancellationToken.None));
        Assert.Null(handler.Url);
    }
    [Fact] public async Task CleartextIndependentProviderRejected()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> { ["AI_BASE_URL"] = "http://provider.example/v1", ["AI_API_KEY"] = "dummy-test-token" }).Build();
        await Assert.ThrowsAsync<ProviderUnavailableException>(() => new ChatResponder(new HttpClient(new Handler("{}")), config).ReplyAsync(new(), [new("user", "Hi")], CancellationToken.None));
    }
}
