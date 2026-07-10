# seo-hygiene Specification

## Purpose
TBD - created by archiving change add-defensive-seo-hygiene. Update Purpose after archive.
## Requirements
### Requirement: App is excluded from search-engine crawling

The web app SHALL serve a `robots.txt` at `/robots.txt` that disallows crawling of the entire app for all user agents, so that no authenticated or app route is crawled or indexed.

#### Scenario: robots.txt disallows the whole app

- **WHEN** any client issues `GET /robots.txt`
- **THEN** the response status is 200 with `Content-Type` `text/plain`
- **THEN** the body contains a `User-agent: *` group
- **THEN** that group contains `Disallow: /`

#### Scenario: An authenticated route is not permitted for crawling

- **WHEN** the served `robots.txt` is evaluated for the path `/agent` (an authenticated route) against user-agent `*`
- **THEN** crawling of `/agent` is disallowed

### Requirement: Public auth routes remain crawlable for link unfurling

The `robots.txt` SHALL explicitly allow the public authentication routes — `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` — so that link-unfurl crawlers (e.g. Slackbot, Twitterbot) may fetch them to render share cards despite the blanket disallow.

#### Scenario: Public auth routes are allowed

- **WHEN** the served `robots.txt` is evaluated against user-agent `*`
- **THEN** each of `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` is allowed for crawling
- **THEN** an app route such as `/onboarding` remains disallowed

### Requirement: Every page has a titled, described document head

The web app SHALL apply a global title template of the form `<page title> · Readion`, a default site title used when a page sets none, and a default meta description, so that no page — and no shared link — renders as a bare, title-less URL.

#### Scenario: A page without its own title uses the site default

- **WHEN** a logged-out client loads a public page that does not set a page-specific title
- **THEN** the rendered HTML `<head>` contains a non-empty `<title>` ending in `· Readion`
- **THEN** the rendered `<head>` contains a `<meta name="description">` with non-empty content

#### Scenario: A page-specific title is composed with the template

- **WHEN** a page sets its title to `Sign in`
- **THEN** the rendered `<title>` is `Sign in · Readion`

### Requirement: Public auth pages emit social share metadata

The `login` and `register` pages SHALL emit Open Graph and Twitter Card metadata so that a link pasted into a social/chat client unfurls into a product card rather than a bare URL.

#### Scenario: Login page emits Open Graph and Twitter tags

- **WHEN** a logged-out client loads `/login`
- **THEN** the rendered `<head>` contains `og:title` and `og:description` meta tags with non-empty content
- **THEN** the rendered `<head>` contains a `twitter:card` meta tag

#### Scenario: Register page emits Open Graph and Twitter tags

- **WHEN** a logged-out client loads `/register`
- **THEN** the rendered `<head>` contains `og:title` and `og:description` meta tags with non-empty content
- **THEN** the rendered `<head>` contains a `twitter:card` meta tag

