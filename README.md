# LinkedIn Repost Filter

An early browser-extension prototype for LinkedIn's authenticated job search results. It checks the selected job details for LinkedIn's explicit repost label, reports matches, and hides them only after you choose **Hide**.

## Load locally

The extension currently uses plain JavaScript and has no build step.

- **Edge / Chrome:** open `edge://extensions` or `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this repository folder.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `manifest.json`.

Open a LinkedIn URL under `/jobs/search-results/`. The Repost Filter panel appears in the lower-right corner. Scan checks the job cards currently loaded on the page; run it again after changing result pages. After the scan, choose **Hide** to remove the detected cards or **Show** to restore them.

## Current scope

- Detection uses LinkedIn's visible `Reposted … ago` label in the selected job details; it does not infer reposts from title, company, or posting age.
- Scan changes the selected job as it checks cards, then restores the job that was selected when scanning began.
- Scan checks cards currently rendered in the results page. Run it again after navigating to another page or loading another batch of results.
- The content script processes the LinkedIn page locally and sends no data to a server.

LinkedIn may change its DOM at any time. The card identification currently relies on the page's `componentkey` convention and should be checked against real pages as LinkedIn updates its UI.
