import SASjs, { SASjsConfig } from "@sasjs/adapter";
import { TestSuite } from "@sasjs/test-framework";
import { ServerType } from "@sasjs/utils/types";

const defaultConfig: SASjsConfig = {
  serverUrl: window.location.origin,
  pathSAS9: "/SASStoredProcess/do",
  pathSASViya: "/SASJobExecution",
  appLoc: "/Public/seedapp",
  serverType: ServerType.SasViya,
  debug: false,
  contextName: "SAS Job Execution compute context",
  useComputeApi: false,
  allowInsecureRequests: false
};

const customConfig = {
  serverUrl: "http://url.com",
  pathSAS9: "sas9",
  pathSASViya: "viya",
  appLoc: "/Public/seedapp",
  serverType: ServerType.Sas9,
  debug: false
};

export const basicTests = (
  adapter: SASjs,
  userName: string,
  password: string
): TestSuite => ({
  name: "Basic Tests",
  tests: [
    {
      title: "Log in",
      description: "Should log the user in",
      test: async () => {
        return adapter.logIn(userName, password);
      },
      assertion: (response: any) =>
        response && response.isLoggedIn && response.userName === userName
    },
    {
      title: "Multiple Log in attempts",
      description:
        "Should fail on first attempt and should log the user in on second attempt",
      test: async () => {
        await adapter.logOut();
        await adapter.logIn("invalid", "invalid");
        return adapter.logIn(userName, password);
      },
      assertion: (response: any) =>
        response && response.isLoggedIn && response.userName === userName
    },
    {
      title: "Default config",
      description:
        "Should instantiate with default config when none is provided",
      test: async () => {
        return Promise.resolve(new SASjs());
      },
      assertion: (sasjsInstance: SASjs) => {
        const sasjsConfig = sasjsInstance.getSasjsConfig();

        return (
          sasjsConfig.serverUrl === defaultConfig.serverUrl &&
          sasjsConfig.pathSAS9 === defaultConfig.pathSAS9 &&
          sasjsConfig.pathSASViya === defaultConfig.pathSASViya &&
          sasjsConfig.appLoc === defaultConfig.appLoc &&
          sasjsConfig.serverType === defaultConfig.serverType &&
          sasjsConfig.debug === defaultConfig.debug
        );
      }
    },
    {
      title: "Custom config",
      description: "Should use fully custom config whenever supplied",
      test: async () => {
        return Promise.resolve(new SASjs(customConfig));
      },
      assertion: (sasjsInstance: SASjs) => {
        const sasjsConfig = sasjsInstance.getSasjsConfig();
        return (
          sasjsConfig.serverUrl === customConfig.serverUrl &&
          sasjsConfig.pathSAS9 === customConfig.pathSAS9 &&
          sasjsConfig.pathSASViya === customConfig.pathSASViya &&
          sasjsConfig.appLoc === customConfig.appLoc &&
          sasjsConfig.serverType === customConfig.serverType &&
          sasjsConfig.debug === customConfig.debug
        );
      }
    },
    {
      title: "Config overrides",
      description: "Should override default config with supplied properties",
      test: async () => {
        return Promise.resolve(
          new SASjs({ serverUrl: "http://test.com", debug: false })
        );
      },
      assertion: (sasjsInstance: SASjs) => {
        const sasjsConfig = sasjsInstance.getSasjsConfig();
        return (
          sasjsConfig.serverUrl === "http://test.com" &&
          sasjsConfig.pathSAS9 === defaultConfig.pathSAS9 &&
          sasjsConfig.pathSASViya === defaultConfig.pathSASViya &&
          sasjsConfig.appLoc === defaultConfig.appLoc &&
          sasjsConfig.serverType === defaultConfig.serverType &&
          sasjsConfig.debug === false
        );
      }
    }
  ]
});
