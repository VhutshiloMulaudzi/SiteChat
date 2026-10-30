namespace SiteChat.Api;

public sealed record ChatMessage(string Role, string Content);
public sealed record ChatRequest(string SiteId, List<ChatMessage> Messages);
public sealed record ApiError(string Code, string Message);

public static class ChatValidation
{
    public const int MaxMessages = 20;
    public const int MaxMessageLength = 2000;
    public const int MaxTotalLength = 12000;

    public static string? Validate(ChatRequest? request)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.SiteId) || request.SiteId.Length > 40)
            return "A valid siteId is required.";
        if (request.Messages is null || request.Messages.Count is < 1 or > MaxMessages)
            return $"Send between 1 and {MaxMessages} messages.";
        var total = 0;
        for (var i = 0; i < request.Messages.Count; i++)
        {
            var message = request.Messages[i];
            if (message is null || message.Role != (i % 2 == 0 ? "user" : "assistant"))
                return "Messages must alternate user and assistant, starting with user.";
            if (string.IsNullOrWhiteSpace(message.Content) || message.Content.Length > MaxMessageLength)
                return $"Each message must contain 1–{MaxMessageLength} characters.";
            total += message.Content.Length;
        }
        if (request.Messages[^1].Role != "user")
            return "The final message must be from the user.";
        return total > MaxTotalLength ? $"Conversation exceeds {MaxTotalLength} characters." : null;
    }
}
