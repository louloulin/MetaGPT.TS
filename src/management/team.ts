import { z } from 'zod';
import { Environment } from '../environment/environment';
import { Context } from '../context/context';
import { Message } from '../types/message';
import { Role } from '../types/role';
import { TeamConfig, TeamConfigSchema, TeamState, TeamStateSchema } from '../types/team';
import { NoMoneyError } from '../utils/errors';
import { readJsonFile, writeJsonFile } from '../utils/file';
import { join } from 'path';

/**
 * Team class for managing multiple roles (agents) and their interactions
 */
export class Team {
  private config: TeamConfig;
  private state: TeamState;
  private env: Environment;

  /**
   * Create a new team instance
   * @param config Team configuration
   */
  constructor(config: TeamConfig) {
    this.config = TeamConfigSchema.parse(config);
    this.state = TeamStateSchema.parse({});
    
    const context = config.context || new Context();
    this.env = config.environment || new Environment({ context });
    
    if (config.roles) {
      this.hire(config.roles);
    }
    
    if (config.envDesc) {
      this.env.setDescription(config.envDesc);
    }
  }

  /**
   * Hire roles to join the team
   * @param roles List of roles to hire
   */
  public hire(roles: Role[]): void {
    this.env.addRoles(roles);
  }

  /**
   * Get the cost manager
   */
  public get costManager() {
    return this.env.context.costManager;
  }

  /**
   * Invest in the team
   * @param amount Investment amount
   */
  public invest(amount: number): void {
    this.config.investment = amount;
    this.costManager.maxBudget = amount;
    console.log(`Investment: $${amount}`);
  }

  /**
   * Check if team has sufficient balance
   * @throws {NoMoneyError} If insufficient funds
   */
  private checkBalance(): void {
    if (this.costManager.totalCost >= this.costManager.maxBudget) {
      throw new NoMoneyError(
        this.costManager.totalCost,
        `Insufficient funds: ${this.costManager.maxBudget}`
      );
    }
  }

  /**
   * Run a project with given idea
   * @param idea Project idea or requirement
   * @param sendTo Target role (optional)
   */
  public runProject(idea: string, sendTo = ''): void {
    this.config.idea = idea;

    // Publish human requirement
    this.env.publishMessage(
      new Message({
        role: 'Human',
        content: idea,
        causedBy: 'UserRequirement',
        sendTo: sendTo || 'ALL'
      })
    );
  }

  /**
   * Run the team for specified rounds
   * @param rounds Number of rounds to run
   * @param idea Optional project idea
   * @param sendTo Optional target role
   * @param autoArchive Whether to auto archive after completion
   */
  public async run(
    rounds = 3,
    idea = '',
    sendTo = '',
    autoArchive = true
  ): Promise<Message[]> {
    if (idea) {
      this.runProject(idea, sendTo);
    }

    while (rounds > 0) {
      if (this.env.isIdle) {
        console.debug('All roles are idle.');
        break;
      }

      rounds--;
      this.checkBalance();
      await this.env.run();

      console.debug(`Max ${rounds} rounds left.`);
    }

    if (autoArchive) {
      await this.env.archive();
    }

    return this.env.history;
  }

  /**
   * Serialize team state to storage
   * @param storagePath Storage path
   */
  public serialize(storagePath: string): void {
    const teamPath = join(storagePath, 'team');
    const teamInfoPath = join(teamPath, 'team.json');

    const data = {
      config: this.config,
      state: this.state,
      context: this.env.context.serialize()
    };

    writeJsonFile(teamInfoPath, data);
  }

  /**
   * Deserialize team state from storage
   * @param storagePath Storage path
   * @param context Optional context
   */
  public static deserialize(storagePath: string, context?: Context): Team {
    const teamPath = join(storagePath, 'team');
    const teamInfoPath = join(teamPath, 'team.json');

    const data = readJsonFile(teamInfoPath);
    const ctx = context || new Context();
    ctx.deserialize(data.context);

    return new Team({
      ...data.config,
      context: ctx
    });
  }
} 