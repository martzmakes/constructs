#!/usr/bin/env node

import { basename, join, resolve } from "path";
import { existsSync, mkdirSync, readdir, remove, writeFile } from "fs-extra";
import prompts from "prompts";
import { execSync } from "child_process";

function toCamelCase(name: string): string {
  return name
    .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ""))
    .replace(/^(.)/, (char) => char.toLowerCase());
}

function toPascalCase(name: string): string {
  return name
    .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ""))
    .replace(/^(.)/, (char) => char.toUpperCase());
}

const binTemplate = ({
  name,
  stackPath,
}: {
  name: string;
  stackPath: string;
}) => `#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { ${toPascalCase(name)}Stack } from '../lib/${stackPath.split(".")[0]}';

const app = new App();
new ${toPascalCase(name)}Stack(app, '${toPascalCase(name)}Stack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  envName: 'main',
  eventSource: '${toCamelCase(name)}',
  table: false, // change this to true if you want a DynamoTable or use:
  /* table: {
    changeDataCapture: true, // to enable changeDataCapture
  } */
});`;

const stackTemplate = ({
  name,
}: {
  name: string;
}) => `import { MMStackProps } from "@martzmakes/constructs/cdk/interfaces/MMStackProps";
import { MMStack } from "@martzmakes/constructs/cdk/stacks/MMStack";
import { Construct } from "constructs";

export interface ${toPascalCase(name)}StackProps extends MMStackProps {
  // add custom properties here
}

export class ${toPascalCase(name)}Stack extends MMStack {
  constructor(scope: Construct, id: string, props: ${toPascalCase(
    name
  )}StackProps) {
    super(scope, id, props);
    
    // add custom resources here
  }
}
`;

async function main() {
  console.log("\n🚀 Welcome to @martzmakes/constructs CDK CLI!\n");

  // Get the current directory name as the default project name
  const currentDirName = basename(process.cwd());

  // Prompt for project name
  const response = await prompts({
    type: "text",
    name: "projectName",
    message: "What is your project name?",
    initial: currentDirName,
  });

  const projectName = response.projectName || currentDirName;
  const destination = resolve(process.cwd(), projectName);

  // If the project name is different, create a new directory and move into it
  if (projectName !== currentDirName) {
    if (existsSync(destination)) {
      const overwriteResponse = await prompts({
        type: "confirm",
        name: "overwrite",
        message: `The directory '${projectName}' already exists. Overwrite it?`,
        initial: false,
      });

      if (!overwriteResponse.overwrite) {
        console.log("❌ Operation cancelled.");
        process.exit(1);
      }

      // Remove existing directory if overwrite is confirmed
      await remove(destination);
    }

    mkdirSync(destination);
    process.chdir(destination);
  }

  // Bootstrap the CDK project
  try {
    console.log("\n⏳ Bootstrapping the CDK project...");
    execSync(`npx cdk@latest init --language=typescript`, {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    console.log("\n✅ CDK project bootstrapped.");
  } catch (error) {
    console.error("❌ Failed to bootstrap the CDK project:", error);
    process.exit(1);
  }

  try {
    console.log("\n⏳ Installing devDependencies...");
    execSync(`npm i esbuild @types/aws-lambda --save-dev`, {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    console.log("\n✅ CDK project bootstrapped.");
  } catch (error) {
    console.error("❌ Failed to install devDependencies:", error);
    process.exit(1);
  }

  try {
    console.log("\n⏳ Installing dependencies...");
    execSync(
      `npm i @aws-lambda-powertools/tracer @martzmakes/constructs --save`,
      {
        cwd: process.cwd(),
        stdio: "inherit",
      }
    );
    console.log("\n✅ CDK project bootstrapped.");
  } catch (error) {
    console.error("❌ Failed to install dependencies:", error);
    process.exit(1);
  }

  // Find the stack file in the lib folder
  const libFolder = join(process.cwd(), "lib");
  let stackFileName = "";
  try {
    const files = await readdir(libFolder);
    stackFileName = files.find((file) => file.endsWith("-stack.ts")) || "";
    if (stackFileName) {
      console.log(`\n🔍 Found stack file: ${stackFileName}`);
    } else {
      console.log(
        "\n⚠️ No stack file ending with '-stack.ts' found in the lib folder."
      );
    }
  } catch (error) {
    console.error("❌ Error reading the lib folder:", error);
  }

  // Create the bin file
  const binFileName = `${stackFileName.split("-stack.ts")[0]}.ts`;
  const binFilePath = join(process.cwd(), "bin", binFileName);
  try {
    console.log(`\n⏳ Creating bin file: ${binFilePath}`);

    const binContent = binTemplate({
      name: projectName,
      stackPath: stackFileName,
    });
    await writeFile(binFilePath, binContent);
    console.log(`✅ Created bin file: ${binFilePath}`);
  } catch (error) {
    console.error("❌ Error creating the bin file:", error);
  }

  // Create the stack file
  const stackFilePath = join(libFolder, stackFileName);
  try {
    console.log(`\n⏳ Creating stack file: ${stackFilePath}`);

    const stackContent = stackTemplate({ name: projectName });
    await writeFile(stackFilePath, stackContent);
    console.log(`✅ Created stack file: ${stackFilePath}`);
  } catch (error) {
    console.error("❌ Error creating the stack file:", error);
  }

  // Add all changes to the last commit
  try {
    console.log("\n⏳ Adding all changes to the last commit...");
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit --amend --no-edit', { stdio: 'inherit' });
    console.log("\n✅ All changes have been added to the last commit.");
  } catch (error) {
    console.error("❌ Failed to add changes to the last commit:", error);
  }
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
