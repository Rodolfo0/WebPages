import { describe, expect, it } from 'vitest';
import { PROJECT_PERMISSION_DEFINITIONS } from '../../../../database/d1/schema';
import {
  canAccessProjectPermission,
  isMemberGrantablePermission,
} from '../../domain/access';

describe('project role permissions', () => {
  it('gives the system owner full access to every registered permission', () => {
    for (const { code } of PROJECT_PERMISSION_DEFINITIONS) {
      expect(canAccessProjectPermission({
        active: true,
        roleKind: 'system_owner',
        permissions: [],
      }, code)).toBe(true);
    }
  });

  it('grants a custom role only permissions explicitly assigned to it', () => {
    expect(canAccessProjectPermission({
      active: true,
      roleKind: 'custom',
      permissions: ['messages:read'],
    }, 'messages:read')).toBe(true);
    expect(canAccessProjectPermission({
      active: true,
      roleKind: 'custom',
      permissions: ['messages:read'],
    }, 'messages:manage')).toBe(false);
  });

  it('denies missing or inactive memberships', () => {
    expect(canAccessProjectPermission(null, 'project:read')).toBe(false);
    expect(canAccessProjectPermission({
      active: false,
      roleKind: 'system_owner',
      permissions: [],
    }, 'project:read')).toBe(false);
  });

  it('keeps project deletion, sharing, and owner management owner-only', () => {
    for (const permission of ['project:delete', 'sharing:manage', 'owners:manage'] as const) {
      expect(isMemberGrantablePermission(permission)).toBe(false);
      expect(canAccessProjectPermission({
        active: true,
        roleKind: 'custom',
        permissions: [],
      }, permission)).toBe(false);
    }
  });
});
