FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Build.props ./
COPY server/SiteChat.Api/SiteChat.Api.csproj server/SiteChat.Api/packages.lock.json server/SiteChat.Api/
RUN dotnet restore server/SiteChat.Api/SiteChat.Api.csproj --locked-mode
COPY server/SiteChat.Api/ server/SiteChat.Api/
RUN dotnet publish server/SiteChat.Api/SiteChat.Api.csproj -c Release --no-restore -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app ./
ENV PORT=3000
EXPOSE 3000
USER $APP_UID
ENTRYPOINT ["dotnet", "SiteChat.Api.dll"]
