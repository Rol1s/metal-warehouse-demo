# Metal warehouse demonstration

Static, customer-safe demonstration for GitHub Pages. The static files are at the repository root. Publish from branch main, folder / (root), in repository Settings → Pages.

All initial data are illustrative. The original customer photo, Excel workbooks, database and credentials are excluded. Each visitor has an independent IndexedDB in their browser. Changes are not sent to GitHub or shared with other visitors. Use the delete-all button to clear this browser’s records after confirmation. The dataset stays empty until you add new records.

This demonstration does not connect Telegram, OCR, a server database or customer Excel. It demonstrates the workflow locally in the browser, including Excel download. Real deployment requires the backend from the separate local MVP and appropriate authentication.

SheetJS CE 0.20.3 is vendored from its official CDN with its Apache 2.0 license. No CDN calls are needed while showing the demo.
