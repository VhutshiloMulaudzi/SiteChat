using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace SiteChat.Api;

public interface IChatResponder
{
    Task<string> ReplyAsync(SiteDefinition site, IReadOnlyList<ChatMessage> messages, CancellationToken cancellationToken);
}

public sealed class ProviderUnavailableException : Exception
{
    public ProviderUnavailableException() : base("The AI service is not configured.") { }
}

public sealed class ChatResponder(HttpClient client, IConfiguration configuration) : IChatResponder
{
    public async Task<string> ReplyAsync(SiteDefinition site, IReadOnlyList<ChatMessage> messages, CancellationToken cancellationToken)
    {
        // User-owned provider configuration is an explicit override; Manus is the managed default.
        var customBase = configuration["AI_BASE_URL"];
        var baseUrl = !string.IsNullOrWhiteSpace(customBase) ? customBase : configuration["MANUS_API_URL"];
        var apiKey = !string.IsNullOrWhiteSpace(customBase) ? configuration["AI_API_KEY"] : configuration["MANUS_API_KEY"];
        if (string.IsNullOrWhiteSpace(baseUrl) || string.IsNullOrWhiteSpace(apiKey))
            throw new ProviderUnavailableException();
        if (!Uri.TryCreate(baseUrl.TrimEnd('/') + "/chat/completions", UriKind.Absolute, out var endpoint)
            || endpoint.Scheme != "https" || endpoint.UserInfo.Length != 0)
            throw new ProviderUnavailableException();
        // MANUS_API_URL is the API root; AI_BASE_URL must already include /v1.
        if (string.IsNullOrWhiteSpace(customBase))
            endpoint = new Uri(baseUrl.TrimEnd('/') + "/v1/chat/completions");
        var providerMessages = new List<object> { new { role = "system", content = site.SystemPrompt } };
        providerMessages.AddRange(messages.Select(message => (object)new { role = message.Role, content = message.Content }));
        var body = new Dictionary<string, object>
        {
            ["model"] = configuration["AI_MODEL"] ?? "gpt-6-luna",
            ["messages"] = providerMessages,
            ["max_completion_tokens"] = 600
        };
        var effort = configuration["AI_REASONING_EFFORT"];
        // The managed default's catalog allows low effort. Independent providers may omit this extension.
        if (string.IsNullOrWhiteSpace(customBase) || !string.IsNullOrWhiteSpace(effort))
            body["reasoning"] = new { effort = effort ?? "low" };
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint) { Content = JsonContent.Create(body) };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        using var response = await client.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
        var root = json.RootElement;
        if (root.TryGetProperty("error", out _) || !root.TryGetProperty("choices", out var choices)
            || choices.ValueKind != JsonValueKind.Array || choices.GetArrayLength() == 0
            || !choices[0].TryGetProperty("message", out var messageElement)
            || !messageElement.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.String)
            throw new HttpRequestException("The AI provider returned no usable reply.");
        var reply = content.GetString();
        if (string.IsNullOrWhiteSpace(reply)) throw new HttpRequestException("The AI provider returned an empty reply.");
        return reply.Length > ChatValidation.MaxMessageLength
            ? reply[..(ChatValidation.MaxMessageLength - 1)] + "…" : reply;
    }
}
