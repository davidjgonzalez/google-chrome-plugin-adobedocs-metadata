# AdobeDocs metadata Google Chrome plugin

+ Website: https://adobedocs-metadata.kestrel-1.io/index.html


## Website administration

+ Website (author): https://admin.kestrel-1.io/content/admin/pages/pages.html

## Build

Run a build or watch, to deploy to /dist. Load /dist via Chrome Extension Manager via Unpacked extensions.

```
$ npm run buld
```

or 

```
$ npm run watch
```

## Release

To release:

1. Update the `manifest.json` and `package.json` version numbers
1. Peform `npm run zip`
1. Upload the generated `plugin.zip` to Google Chrome Extension Manager
1. Commit version changes to Git
