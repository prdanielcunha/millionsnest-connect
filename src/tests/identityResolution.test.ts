import assert from 'node:assert/strict';
import {
  automaticPotentialFromPriority,
  compareIdentity,
  manualPriorityRank,
  normalizeIdentityName,
  normalizePhone,
  potentialRank,
} from '../personal/radar/identityResolution';

function run() {
  assert.equal(normalizePhone('+55 (43) 99999-1111'), '5543999991111');
  assert.equal(normalizePhone('123'), null);
  assert.equal(normalizeIdentityName('Pr. João  Silva'), 'pr joao silva');

  const samePhone = compareIdentity(
    { displayName: 'João', normalizedName: 'joao', phone: '+55 43 99999-1111' },
    { displayName: 'Pr. João Silva', normalizedName: 'pr joao silva', phone: '5543999991111' },
  );
  assert.equal(samePhone.kind, 'strong');
  assert.equal(samePhone.confidence, 100);

  const sameNameOnly = compareIdentity(
    { displayName: 'João Silva', normalizedName: 'joao silva', phone: null },
    { displayName: 'João Silva', normalizedName: 'joao silva', phone: null },
  );
  assert.equal(sameNameOnly.kind, 'ambiguous');
  assert.ok(sameNameOnly.confidence < 90);

  const sameNameDifferentPhone = compareIdentity(
    { displayName: 'João Silva', normalizedName: 'joao silva', phone: '5543999991111' },
    { displayName: 'João Silva', normalizedName: 'joao silva', phone: '5543988882222' },
  );
  assert.equal(sameNameDifferentPhone.kind, 'conflict');

  const confirmedAlias = compareIdentity(
    { displayName: 'Pr João', normalizedName: 'pr joao', phone: null },
    { displayName: 'João Silva', normalizedName: 'joao silva', identityConfirmedAliases: ['pr joao'] },
  );
  assert.equal(confirmedAlias.kind, 'strong');

  const blockedAlias = compareIdentity(
    { displayName: 'João', normalizedName: 'joao', phone: null },
    { displayName: 'João', normalizedName: 'joao', identityBlockedAliases: ['joao'] },
  );
  assert.equal(blockedAlias.kind, 'conflict');

  assert.equal(automaticPotentialFromPriority(0), 'very_high');
  assert.ok(potentialRank('very_high') < potentialRank('medium'));
  assert.ok(manualPriorityRank('priority') < manualPriorityRank('normal'));

  console.log('identityResolution.test.ts: ok');
}

run();
