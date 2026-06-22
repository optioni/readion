## Purpose

Specifies the Progressive Web App configuration for the Nuxt web app: installability requirements (manifest, icons, service worker), and the responsive viewport declaration.

## Requirements

### Requirement: Installable Progressive Web App

The web app SHALL be installable as a Progressive Web App. It MUST serve a valid web app manifest with a name, short name, theme color, background color, `display: standalone`, a start URL, and at least the 192px and 512px icons required for installability.

#### Scenario: Manifest is served and well-formed

- **WHEN** a Playwright test requests the web app manifest (e.g. `/manifest.webmanifest`)
- **THEN** the response is JSON containing `name`, `short_name`, `display: "standalone"`, `start_url`, `theme_color`, and an `icons` array including entries of sizes `192x192` and `512x512`

#### Scenario: Document links the manifest and theme color

- **WHEN** a Playwright test loads `/`
- **THEN** the HTML `<head>` contains a `<link rel="manifest">` and a `<meta name="theme-color">` tag

### Requirement: Service worker registered for installability only

A service worker SHALL be registered to satisfy PWA install criteria. It MUST NOT implement offline content caching — offline mode is an explicit Non-Goal in SPEC.

#### Scenario: Service worker is registered

- **WHEN** the app boots in a browser context in a Playwright test
- **THEN** a service worker registration is present for the app scope

#### Scenario: No offline content caching

- **WHEN** the PWA configuration is inspected
- **THEN** it does not configure runtime caching of API responses or app content for offline use (installability only)

### Requirement: Responsive viewport

The app SHALL declare a responsive viewport so phone-quality layouts render correctly, supporting the quick "5-minute review" on small screens described in SPEC.

#### Scenario: Viewport meta is present

- **WHEN** a Playwright test loads `/`
- **THEN** the HTML `<head>` contains `<meta name="viewport" content="width=device-width, initial-scale=1">`
