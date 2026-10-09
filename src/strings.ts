export const copy = {
  title: 'x40 Short Link', setupTitle: 'Connect x40', createTitle: 'Create a short link',
  tokenHelp: 'Paste a bearer token that authorizes CreateShortLink. This extension cannot issue tokens.',
  slugHelp: 'Optional. A custom path may already be taken.',
  copied: 'Copied', copyAction: 'Copy', openForm: 'Open form',
  noSetup: 'Set up your x40 instance before creating a link.',
  invalidDestination: 'Enter an HTTP or HTTPS destination URL.',
  invalidDomain: 'Enter a hostname without a scheme, port, or path.',
  invalidSlug: 'Enter a path without a query, fragment, or control characters.',
  invalidBase: 'Enter an HTTPS API origin without a path, query, or credentials.',
  tokenNeeded: 'Enter a CreateShortLink bearer token in settings.',
  network: 'Could not reach the API. Check the connection and retry.',
  timeout: 'The API did not respond in time. Retry with the same request ID.',
  protocol: 'The API returned an invalid short link. Retry or contact the instance owner.'
} as const;
