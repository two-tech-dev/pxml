# Getting Started Guide

This guide walks you through setting up a project using `pxml` and compiling it using an AI provider.

## Prerequisites
- Node.js (v18 or higher)
- npm

## 1. Installation
Clone the repository and install the compiler globally:
```bash
git clone https://github.com/two-tech-dev/pxml.git
cd pxml
npm install
npm run build
sudo npm link
```

## 2. Initialize a Project
Create a new directory for your app and run the initializer:
```bash
mkdir my-new-app && cd my-new-app
pxml init
```
This will initialize:
- `project.xml`: Main compiler configuration file.
- `flows/blog.xml`: Sample blog flow node layout configuration.
- `pxml.xsd`: Local XML schema to enable auto-complete, validation, and documentation hints inside code editors.

## 3. Compile the Code
Select your preferred AI model provider and run the compiler:

### Using OpenAI (or compatible gateways like 9Router):
```bash
export OPENAI_API_KEY="your-api-key"
pxml compile --provider openai --model gpt-4o --baseUrl https://api.openai.com/v1
```

### Using Anthropic:
```bash
export ANTHROPIC_API_KEY="your-api-key"
pxml compile --provider anthropic --model claude-3-5-sonnet
```

### Using Local Ollama:
```bash
pxml compile --provider ollama --model llama3 --baseUrl http://localhost:11434
```

## 4. Run Tests & Self-Heal
To run compiled Vitest suites:
```bash
pxml test
```

If a test case fails, call the local AI repair helper loop to patch the implementation:
```bash
pxml fix --flow=blog.write
```
The self-healing workflow will generate a minimal context code fix, patch the target file, and verify it automatically.
