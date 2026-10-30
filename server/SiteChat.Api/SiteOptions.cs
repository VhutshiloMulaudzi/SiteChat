namespace SiteChat.Api;

public sealed class SiteChatOptions
{
    public Dictionary<string, SiteDefinition> Sites { get; set; } = new(StringComparer.Ordinal);
}

public sealed class SiteDefinition
{
    public string SystemPrompt { get; set; } = "You are a helpful website assistant. Be concise. Never claim to have accessed pages or company information that has not been provided. Say when you do not know.";
    public string[] Origins { get; set; } = [];
}

public static class OriginPolicy
{
    public static bool IsAllowed(string? origin, SiteDefinition site)
    {
        if (string.IsNullOrWhiteSpace(origin) || !Uri.TryCreate(origin, UriKind.Absolute, out var uri))
            return false;
        if (uri.Scheme is not ("https" or "http") || uri.UserInfo.Length != 0 || uri.AbsolutePath != "/" || uri.Query.Length != 0 || uri.Fragment.Length != 0)
            return false;
        // A scheme, hostname or port change represents a different origin. No wildcard matching.
        return site.Origins.Any(allowed => string.Equals(origin, allowed, StringComparison.OrdinalIgnoreCase));
    }
}
