export function wrapInBaseLayout(content: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Readion</title>
  </head>
  <body>
    ${content}
  </body>
</html>`
}
