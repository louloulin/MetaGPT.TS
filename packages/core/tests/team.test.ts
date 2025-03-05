import { describe, expect, test, mock, beforeAll, afterAll } from 'bun:test';
import { Team } from '../src/management/team';
import { Context } from '../src/context/context';
import { Environment } from '../src/environment/environment';
import { Role } from '../src/types/role';
import { Message } from '../src/types/message';
import { NoMoneyError } from '../src/utils/errors';

describe('Team Management', () => {
  // Mock role class for testing
  class TestRole implements Role {
    name = 'TestRole';
    profile = 'Test profile';
    goal = 'Test goal';
    constraints = 'Test constraints';
    
    async observe(): Promise<number> {
      return 0;
    }
    
    async think(): Promise<boolean> {
      return true;
    }
    
    async act(): Promise<Message> {
      return new Message({
        role: this.name,
        content: 'Test action',
        causedBy: 'TestAction'
      });
    }
  }

  describe('Team Initialization', () => {
    test('should create team with default config', () => {
      const team = new Team({});
      expect(team).toBeDefined();
      expect(team.costManager).toBeDefined();
    });

    test('should create team with custom config', () => {
      const context = new Context();
      const env = new Environment({ context });
      const roles = [new TestRole()];

      const team = new Team({
        environment: env,
        investment: 100,
        idea: 'Test idea',
        context,
        roles,
        envDesc: 'Test environment'
      });

      expect(team).toBeDefined();
      expect(team.costManager.maxBudget).toBe(100);
    });
  });

  describe('Team Operations', () => {
    let team: Team;
    let role: TestRole;

    beforeAll(() => {
      team = new Team({});
      role = new TestRole();
    });

    test('should hire roles', () => {
      team.hire([role]);
      // Verify through running a project
      team.runProject('Test project');
      expect(team['env'].roles).toContain(role);
    });

    test('should invest funds', () => {
      team.invest(200);
      expect(team.costManager.maxBudget).toBe(200);
    });

    test('should throw error on insufficient funds', () => {
      team.costManager.totalCost = 300;
      expect(() => team['checkBalance']()).toThrow(NoMoneyError);
    });
  });

  describe('Project Execution', () => {
    let team: Team;
    let role: TestRole;

    beforeAll(() => {
      team = new Team({});
      role = new TestRole();
      team.hire([role]);
      team.invest(1000);
    });

    test('should run project with idea', async () => {
      const history = await team.run(1, 'Test project');
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].content).toBe('Test project');
    });

    test('should stop when roles are idle', async () => {
      team['env'].isIdle = true;
      const history = await team.run(5, 'Test idle');
      expect(history.length).toBeGreaterThan(0);
    });

    test('should archive after completion', async () => {
      const mockArchive = mock(() => Promise.resolve());
      team['env'].archive = mockArchive;
      
      await team.run(1, 'Test archive');
      expect(mockArchive).toHaveBeenCalled();
    });
  });

  describe('Serialization', () => {
    let team: Team;
    const storagePath = './test-storage';

    beforeAll(() => {
      team = new Team({
        investment: 500,
        idea: 'Test serialization'
      });
    });

    test('should serialize team state', () => {
      team.serialize(storagePath);
      // Verify file exists and content
      const deserializedTeam = Team.deserialize(storagePath);
      expect(deserializedTeam['config'].investment).toBe(500);
      expect(deserializedTeam['config'].idea).toBe('Test serialization');
    });

    afterAll(() => {
      // Clean up test storage
      // TODO: Implement cleanup
    });
  });
}); 