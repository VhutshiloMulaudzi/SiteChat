using SiteChat.Api;

namespace SiteChat.Tests;

public class ValidationTests
{
    [Fact] public void ValidConversationPasses() => Assert.Null(ChatValidation.Validate(new("demo", [new("user", "Hello"), new("assistant", "Hi"), new("user", "Help")] )));
    [Fact] public void NullRequestFails() => Assert.NotNull(ChatValidation.Validate(null));
    [Fact] public void EmptyMessagesFail() => Assert.NotNull(ChatValidation.Validate(new("demo", [])));
    [Fact] public void NullMessagesFail() => Assert.NotNull(ChatValidation.Validate(new("demo", null!)));
    [Fact] public void NullMessageFails() => Assert.NotNull(ChatValidation.Validate(new("demo", [null!])));
    [Theory] [InlineData("system")] [InlineData("tool")] [InlineData("assistant")] [InlineData("USER")]
    public void InvalidInitialRolesFail(string role) => Assert.NotNull(ChatValidation.Validate(new("demo", [new(role, "Hello")])));
    [Fact] public void AssistantFinalMessageFails() => Assert.NotNull(ChatValidation.Validate(new("demo", [new("user", "Hello"), new("assistant", "Hi")])));
    [Fact] public void ConsecutiveUserMessagesFail() => Assert.NotNull(ChatValidation.Validate(new("demo", [new("user", "Hello"), new("user", "Hi")])));
    [Theory] [InlineData("")] [InlineData("   ")]
    public void EmptyContentFails(string content) => Assert.NotNull(ChatValidation.Validate(new("demo", [new("user", content)])));
    [Fact] public void OversizedMessageFails() => Assert.NotNull(ChatValidation.Validate(new("demo", [new("user", new string('a', 2001))])));
    [Fact] public void ExactMessageLimitPasses() => Assert.Null(ChatValidation.Validate(new("demo", [new("user", new string('a', 2000))])));
    [Fact] public void TooManyMessagesFail() => Assert.NotNull(ChatValidation.Validate(new("demo", Enumerable.Range(0, 21).Select(i => new ChatMessage(i % 2 == 0 ? "user" : "assistant", "a")).ToList())));
    [Fact] public void TooMuchTotalContentFails() => Assert.NotNull(ChatValidation.Validate(new("demo", Enumerable.Range(0, 7).Select(i => new ChatMessage(i % 2 == 0 ? "user" : "assistant", new string('a', 2000))).ToList())));
    [Theory] [InlineData(null)] [InlineData("")] [InlineData("https://allowed.example.evil.test")] [InlineData("http://allowed.example")] [InlineData("https://allowed.example:8443")] [InlineData("https://allowed.example/path")] [InlineData("https://allowed.example?query=1")]
    public void NonAllowedOriginsFail(string? origin) => Assert.False(OriginPolicy.IsAllowed(origin, new() { Origins = ["https://allowed.example"] }));
    [Fact] public void ExactOriginPasses() => Assert.True(OriginPolicy.IsAllowed("https://allowed.example", new() { Origins = ["https://allowed.example"] }));
}
