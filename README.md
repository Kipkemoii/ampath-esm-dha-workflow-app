# OpenMRS ESM Template App

![Node.js CI](https://github.com/openmrs/openmrs-esm-template-app/workflows/Node.js%20CI/badge.svg)

This repository serves as a template for building OpenMRS frontend modules. For detailed guidance, see the [Creating a Frontend Module](https://openmrs.atlassian.net/wiki/x/rIIBCQ) documentation.

For more information, please see the [OpenMRS Frontend Developer Documentation](https://openmrs.atlassian.net/wiki/x/IABBHg).

The [Setup](https://openmrs.atlassian.net/wiki/x/PIIBCQ) section will help you get started with frontend module development.

## Running this code

```sh
yarn  # to install dependencies
yarn start  # to run the dev server
```

Once it is running, a browser window should open running the O3 reference application. Log in and then navigate to `/openmrs/spa/root`.

## Local development — HIE / preauth

Claims and preauth API calls use config key `hieBaseUrl` (see `src/config-schema.ts`), resolved by `getHieBaseUrl()`. That URL should point at **amrs-integrations `hie-saf`**, which then calls DHA via its own `HIE_CLIAMS_BASE_URL`.

`yarn dev` uses the remote o3-config only. To point HIE/preauth at local hie-saf, run `yarn dev:local`, which loads [`local-config.json`](./local-config.json):

```json
{
  "@ampath/esm-dha-workflow-app": {
    "hieBaseUrl": "http://localhost:3000"
  }
}
```

So with `dev:local`, preauth and other HIE proxy calls go to local hie-saf on port 3000.
Keep `HIE_CLIAMS_BASE_URL` in `amrs-integrations/packages/hie-saf/.env` pointed at DHA UAT (or a mock). See that package’s `.env.example` and README.

Do not commit localhost as the schema `_default` for `hieBaseUrl`.

## SHR terminology (`shr-code-systems.json`)

The SHR sends many codings bare — a `code` with no `display` (vital-sign LOINC
codes, body regions, exam findings). Their `coding.system` is a resolvable FHIR
`CodeSystem` URL, but the browser cannot fetch it: the O3 app shell's
Content-Security-Policy `connect-src` does not list the SHA FHIR host, so the
request is blocked before it is sent, and there is no `hie-saf` passthrough
route for arbitrary terminology.

So the concepts ship with the bundle, in
[`src/shr/shr-code-systems.json`](./src/shr/shr-code-systems.json), keyed by
CodeSystem **id** (the last path segment) so one copy is correct across UAT and
production hosts. To refresh it after SHA publishes new codes:

```sh
yarn update-shr-code-systems                          # defaults to the UAT server
yarn update-shr-code-systems --server https://host/fhir
```

Only the `em-*` systems are taken — the ones the SHR sends bare, and the ones
whose displays are written for clinicians. The server's other ~110 systems are
deliberately left out: the big catalogues (diagnoses, interventions, drugs)
never arrive as bare codings, and several small ones carry displays that are
worse than humanising the code (`knhts-contact-relationship-cs` maps `parent`
to lowercase "parent"; `knhts-code-systems-cs` maps `loinc` to the URL
"http://loinc.org"). A code we don't carry falls back to the raw code, which is
better than confidently wrong text in a clinical view.

## Adapting the code

1. Replace all instances of "template" with your frontend module's name
2. Update `index.ts` with your feature name, page name, and route
3. Rename the `root.*` files to match your first page
4. Clear `config-schema` objects and rebuild as needed
5. Delete the `greeter` and `patient-getter` directories and clear `root.component.tsx`
6. Clear `translations/en.json`
7. Update `.github/workflows` for your deployment needs
8. Replace this README with documentation for your module

At this point, you should be able to write your first page as a React application.

See the [Medication dispensing app](https://github.com/openmrs/openmrs-esm-dispensing-app) for a complete example of a non-trivial frontend module built using this template.

## Integration

See [Creating a Frontend Module](https://openmrs.atlassian.net/wiki/x/rIIBCQ) for details on how to integrate your custom frontend module into the OpenMRS reference application.
