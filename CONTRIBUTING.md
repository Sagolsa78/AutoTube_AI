# Contributing to AutoShorts Studio

First off, thanks for taking the time to contribute! ❤️

All types of contributions are encouraged and valued. See the [Table of Contents](#table-of-contents) for different ways to help and details about how this project handles them. Please make sure to read the relevant section before making your contribution.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [I Have a Question](#i-have-a-question)
- [I Want To Contribute](#i-want-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Your First Code Contribution](#your-first-code-contribution)
  - [Pull Requests](#pull-requests)
- [Styleguides](#styleguides)

## Code of Conduct

This project and everyone participating in it is governed by a Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## I Have a Question

Before you ask a question, it is best to search for existing [Issues](https://github.com/yourusername/autoshorts-studio/issues) that might help you. In case you have found a suitable issue and still need clarification, you can write your question in this issue.

If you then still feel the need to ask a question and need clarification, we recommend the following:
- Open an [Issue](https://github.com/yourusername/autoshorts-studio/issues/new).
- Provide as much context as you can about what you're running into.
- Provide project and platform versions (nodejs, npm, python, ffmpeg, etc).

## I Want To Contribute

### Reporting Bugs

Bugs are tracked as GitHub issues. When you are creating a bug report, please include as many details as possible:
* **Use a clear and descriptive title** for the issue to identify the problem.
* **Describe the exact steps which reproduce the problem** in as many details as possible.
* **Provide specific examples to demonstrate the steps.** Include links to files or GitHub projects, or copy/pasteable snippets.
* **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
* **Explain which behavior you expected to see instead and why.**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When you are creating an enhancement suggestion, please include:
* **Use a clear and descriptive title** for the issue to identify the suggestion.
* **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
* **Describe the current behavior** and **explain which behavior you expected to see instead** and why.
* **Explain why this enhancement would be useful** to most users.

### Your First Code Contribution

1. Fork the repository
2. Create a virtual environment for the backend and install dependencies (`pip install -r requirements.txt`)
3. Install frontend dependencies (`cd frontend && npm install`)
4. Verify you can run the pipeline locally and render a video successfully.

### Pull Requests

* Fill in the required template
* Do not include issue numbers in the PR title
* Follow the Python (PEP8) and JavaScript (ESLint/Prettier) styleguides.
* Include screenshots and animated GIFs in your pull request whenever possible if you are changing the UI.
* End all files with a newline.
* Document any changes to FFmpeg filtergraphs rigorously in the PR description, as filter modifications can easily break cross-platform compatibility.

## Styleguides

### Python (Backend)
- Use `black` and `ruff` for formatting and linting.
- Follow strict type hinting standards (`def my_func(arg: str) -> bool:`).
- Document all core logic within `engine/` modules (especially `assembler.py` and FFmpeg calls) using clear docstrings.

### JavaScript/React (Frontend)
- Adhere to standard functional React patterns with hooks.
- Follow the established **UI/UX Pro Max** styling principles when adding components (e.g., use the `<Icon />` component instead of emojis, ensure WCAG AA contrast, no ad-hoc inline styles for core layouts).
- Use `index.css` design tokens (variables) instead of hardcoding hex colors.
