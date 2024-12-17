import { execSync } from "child_process";

export const props = (props: {
  baseStackName: string;
  envName?: string;
}) => {
  const { baseStackName: baseName, envName } = props;
  const branch =
    process.env.GITHUB_REF_NAME ||
    execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
  const gitSha = execSync("git rev-parse HEAD").toString().trim();
  const description = `${baseName} (${envName || branch} - ${gitSha})`;
  const stackName = `${baseName}-${envName || branch}`;
  const account = process.env.CDK_DEFAULT_ACCOUNT!;

  return { description, stackName, env: { account, region: "us-east-1" }, envName: envName || branch };
};
