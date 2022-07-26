# Contributing

## Code of Conduct

All members of the project community must abide by the [Contributor Covenant, version 2.1](CODE_OF_CONDUCT.md).
Only by respecting each other we can develop a productive, collaborative community.
Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting [a project maintainer](.reuse/dep5).

## Engaging in Our Project

We use GitHub to manage reviews of pull requests.

* If you are a new contributor, see: [Steps to Contribute](#steps-to-contribute)

* Before implementing your change, create an issue that describes the problem you would like to solve or the code that should be enhanced. Please note that you are willing to work on that issue.

* The team will review the issue and decide whether it should be implemented as a pull request. In that case, they will assign the issue to you. If the team decides against picking up the issue, the team will post a comment with an explanation.

## Steps to Contribute

Should you wish to work on an issue, please claim it first by commenting on the GitHub issue that you want to work on. This is to prevent duplicated efforts from other contributors on the same issue.

If you have questions about one of the issues, please comment on them, and one of the maintainers will clarify.

## Contributing Code or Documentation

You are welcome to contribute code in order to fix a bug or to implement a new feature that is logged as an issue.

The following rule governs code contributions:

* Contributions must be licensed under the [Apache 2.0 License](./LICENSE)
* Due to legal reasons, contributors will be asked to accept a Developer Certificate of Origin (DCO) when they create the first pull request to this project. This happens in an automated fashion during the submission process. SAP uses [the standard DCO text of the Linux Foundation](https://developercertificate.org/).

## Issues and Planning

* We use GitHub issues to track bugs and enhancement requests.

* Please provide as much context as possible when you open an issue. The information you provide must be comprehensive enough to reproduce that issue for the assignee.

## Processes

### How to Contribute?

Make sure the change would be welcome (e.g. a bugfix or a useful feature); best do so by proposing it in a GitHub issue

1. Create a branch forking the `SAP/ui5-tooling-webc` repository and do your change.

2. Commit (with a commit message following the [conventional-commit](https://www.conventionalcommits.org/) syntax) and push your changes on that branch

3. If your change fixes an issue reported at GitHub, add a [keyword](https://help.github.com/articles/closing-issues-using-keywords/) like `fix <issue ID>` to the commit message:

4. Create a Pull Request to this repository

5. Wait for our code review and approval, possibly enhancing your change on request

   Note that the developers also have their regular duties, so depending on the required effort for reviewing, testing and clarification this may take a while

6. Once the change has been approved we will inform you in a comment

### How to Release?

:warning: Make sure to use at least NPM v8.x!

First, make sure that you pull the latest state of the GitHub repository and then proceed with the following steps:

1. Update the version: `npm version patch|minor|major`

2. Push the new commit and tag: `git push && git push --tags`

A GitHub action will do the needful once the new tag has been pushed.
