import { Context, EditContextInput, ContextAllAttributes } from './types'
import { isUrl } from './utils'
import { prefixMessage } from '@sasjs/utils/error'
import { RequestClient } from './request/RequestClient'

export class ContextManager {
  private defaultComputeContexts = [
    'CAS Formats service compute context',
    'Data Mining compute context',
    'Import 9 service compute context',
    'SAS Job Execution compute context',
    'SAS Model Manager compute context',
    'SAS Studio compute context',
    'SAS Visual Forecasting compute context'
  ]
  private defaultLauncherContexts = [
    'CAS Formats service launcher context',
    'Data Mining launcher context',
    'Import 9 service launcher context',
    'Job Flow Execution launcher context',
    'SAS Job Execution launcher context',
    'SAS Model Manager launcher context',
    'SAS Studio launcher context',
    'SAS Visual Forecasting launcher context'
  ]

  get getDefaultComputeContexts() {
    return this.defaultComputeContexts
  }
  get getDefaultLauncherContexts() {
    return this.defaultLauncherContexts
  }

  constructor(private serverUrl: string, private requestClient: RequestClient) {
    if (serverUrl) isUrl(serverUrl)
  }

  public async getComputeContexts(accessToken?: string) {
    const { result: contexts } = await this.requestClient
      .get<{ items: Context[] }>(
        `${this.serverUrl}/compute/contexts?limit=10000`,
        accessToken
      )
      .catch((err) => {
        throw prefixMessage(err, 'Error while getting compute contexts. ')
      })

    const contextsList = contexts && contexts.items ? contexts.items : []

    return contextsList.map((context: any) => ({
      createdBy: context.createdBy,
      id: context.id,
      name: context.name,
      version: context.version,
      attributes: {}
    }))
  }

  public async getLauncherContexts(accessToken?: string) {
    const { result: contexts } = await this.requestClient
      .get<{ items: Context[] }>(
        `${this.serverUrl}/launcher/contexts?limit=10000`,
        accessToken
      )
      .catch((err) => {
        throw prefixMessage(err, 'Error while getting launcher contexts. ')
      })

    const contextsList = contexts && contexts.items ? contexts.items : []

    return contextsList.map((context: any) => ({
      createdBy: context.createdBy,
      id: context.id,
      name: context.name,
      version: context.version,
      attributes: {}
    }))
  }

  public async createComputeContext(
    contextName: string,
    launchContextName: string,
    sharedAccountId: string,
    autoExecLines: string[],
    accessToken?: string,
    authorizedUsers?: string[]
  ) {
    this.validateContextName(contextName)

    this.isDefaultContext(
      contextName,
      this.defaultComputeContexts,
      `Compute context '${contextName}' already exists.`
    )

    const existingComputeContexts = await this.getComputeContexts(accessToken)

    if (
      existingComputeContexts.find((context) => context.name === contextName)
    ) {
      throw new Error(`Compute context '${contextName}' already exists.`)
    }

    if (launchContextName) {
      if (!this.defaultLauncherContexts.includes(launchContextName)) {
        const launcherContexts = await this.getLauncherContexts(accessToken)

        if (
          !launcherContexts.find(
            (context) => context.name === launchContextName
          )
        ) {
          const description = `The launcher context for ${launchContextName}`
          const launchType = 'direct'

          const newLauncherContext = await this.createLauncherContext(
            launchContextName,
            description,
            launchType,
            accessToken
          ).catch((err) => {
            throw new Error(`Error while creating launcher context. ${err}`)
          })

          if (newLauncherContext && newLauncherContext.name) {
            launchContextName = newLauncherContext.name
          } else {
            throw new Error('Error while creating launcher context.')
          }
        }
      }
    }

    const headers: any = {
      'Content-Type': 'application/json'
    }

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    let attributes = { reuseServerProcesses: true } as object

    if (sharedAccountId)
      attributes = { ...attributes, runServerAs: sharedAccountId }

    const requestBody: any = {
      name: contextName,
      launchContext: {
        contextName: launchContextName || ''
      },
      attributes
    }

    if (authorizedUsers && authorizedUsers.length) {
      requestBody['authorizedUsers'] = authorizedUsers
    } else {
      requestBody['authorizeAllAuthenticatedUsers'] = true
    }

    if (autoExecLines) {
      requestBody.environment = { autoExecLines }
    }

    const { result: context } = await this.requestClient
      .post<Context>(
        `${this.serverUrl}/compute/contexts`,
        requestBody,
        accessToken
      )
      .catch((err) => {
        throw prefixMessage(err, 'Error while creating compute context. ')
      })

    return context
  }

  public async createLauncherContext(
    contextName: string,
    description: string,
    launchType = 'direct',
    accessToken?: string
  ) {
    if (!contextName) {
      throw new Error('Context name is required.')
    }

    this.isDefaultContext(
      contextName,
      this.defaultLauncherContexts,
      `Launcher context '${contextName}' already exists.`
    )

    const existingLauncherContexts = await this.getLauncherContexts(accessToken)

    if (
      existingLauncherContexts.find((context) => context.name === contextName)
    ) {
      throw new Error(`Launcher context '${contextName}' already exists.`)
    }

    const headers: any = {
      'Content-Type': 'application/json'
    }

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    const requestBody: any = {
      name: contextName,
      description: description,
      launchType
    }

    const { result: context } = await this.requestClient
      .post<Context>(
        `${this.serverUrl}/launcher/contexts`,
        requestBody,
        accessToken
      )
      .catch((err) => {
        throw prefixMessage(err, 'Error while creating launcher context. ')
      })

    return context
  }

  public async editComputeContext(
    contextName: string,
    editedContext: EditContextInput,
    accessToken?: string
  ) {
    this.validateContextName(contextName)

    this.isDefaultContext(
      contextName,
      this.defaultComputeContexts,
      'Editing default SAS compute contexts is not allowed.',
      true
    )

    let originalContext

    originalContext = await this.getComputeContextByName(
      contextName,
      accessToken
    )

    // Try to find context by id, when context name has been changed.
    if (!originalContext) {
      originalContext = await this.getComputeContextById(
        editedContext.id!,
        accessToken
      )
    }

    const { result: context, etag } = await this.requestClient
      .get<Context>(
        `${this.serverUrl}/compute/contexts/${originalContext.id}`,
        accessToken
      )
      .catch((err) => {
        if (err && err.status === 404) {
          throw new Error(
            `The context '${contextName}' was not found on this server.`
          )
        }

        throw err
      })

    // An If-Match header with the value of the last ETag for the context
    // is required to be able to update it
    // https://developer.sas.com/apis/rest/Compute/#update-a-context-definition
    return await this.requestClient.put<Context>(
      `/compute/contexts/${context.id}`,
      {
        ...context,
        ...editedContext,
        attributes: { ...context.attributes, ...editedContext.attributes }
      },
      accessToken,
      { 'If-Match': etag }
    )
  }

  public async getComputeContextByName(
    contextName: string,
    accessToken?: string
  ): Promise<Context> {
    const { result: contexts } = await this.requestClient
      .get<{ items: Context[] }>(
        `${this.serverUrl}/compute/contexts?filter=eq(name, "${contextName}")`,
        accessToken
      )
      .catch((err) => {
        throw prefixMessage(
          err,
          'Error while getting compute context by name. '
        )
      })

    if (!contexts || !(contexts.items && contexts.items.length)) {
      throw new Error(
        `The context '${contextName}' was not found at '${this.serverUrl}'.`
      )
    }

    return contexts.items[0]
  }

  public async getComputeContextById(
    contextId: string,
    accessToken?: string
  ): Promise<ContextAllAttributes> {
    const { result: context } = await this.requestClient
      .get<ContextAllAttributes>(
        `${this.serverUrl}/compute/contexts/${contextId}`,
        accessToken
      )
      .catch((err) => {
        throw prefixMessage(err, 'Error while getting compute context by id. ')
      })

    return context
  }

  public async getExecutableContexts(
    executeScript: Function,
    accessToken?: string
  ) {
    const { result: contexts } = await this.requestClient
      .get<{ items: Context[] }>(
        `${this.serverUrl}/compute/contexts?limit=10000`,
        accessToken
      )
      .catch((err) => {
        throw prefixMessage(err, 'Error while fetching compute contexts.')
      })

    const contextsList = contexts.items || []
    const executableContexts: any[] = []

    const promises = contextsList.map((context: any) => {
      const linesOfCode = ['%put &=sysuserid;']

      return () =>
        executeScript(
          `test-${context.name}`,
          linesOfCode,
          context.name,
          accessToken,
          null,
          false,
          true,
          true
        ).catch((err: any) => err)
    })

    let results: any[] = []

    for (const promise of promises) results.push(await promise())

    results.forEach((result: any, index: number) => {
      if (result && result.log) {
        try {
          const resultParsed = result.log
          let sysUserId = ''

          const sysUserIdLog = resultParsed
            .split('\n')
            .find((line: string) => line.startsWith('SYSUSERID='))

          if (sysUserIdLog) {
            sysUserId = sysUserIdLog.replace('SYSUSERID=', '')

            executableContexts.push({
              createdBy: contextsList[index].createdBy,
              id: contextsList[index].id,
              name: contextsList[index].name,
              version: contextsList[index].version,
              attributes: {
                sysUserId
              }
            })
          }
        } catch (error) {
          throw error
        }
      }
    })

    return executableContexts
  }

  public async deleteComputeContext(contextName: string, accessToken?: string) {
    this.validateContextName(contextName)

    this.isDefaultContext(
      contextName,
      this.defaultComputeContexts,
      'Deleting default SAS compute contexts is not allowed.',
      true
    )

    const headers: any = {
      'Content-Type': 'application/json'
    }

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    const context = await this.getComputeContextByName(contextName, accessToken)

    return await this.requestClient.delete<Context>(
      `${this.serverUrl}/compute/contexts/${context.id}`,
      accessToken
    )
  }

  // TODO: implement editLauncherContext method

  // TODO: implement deleteLauncherContext method

  private validateContextName(name: string) {
    if (!name) throw new Error('Context name is required.')
  }

  public isDefaultContext(
    context: string,
    defaultContexts: string[] = this.defaultComputeContexts,
    errorMessage = '',
    listDefaults = false
  ) {
    if (defaultContexts.includes(context)) {
      throw new Error(
        `${errorMessage}${
          listDefaults
            ? '\nDefault contexts:' +
              defaultContexts.map((context, i) => `\n${i + 1}. ${context}`)
            : ''
        }`
      )
    }
  }
}
