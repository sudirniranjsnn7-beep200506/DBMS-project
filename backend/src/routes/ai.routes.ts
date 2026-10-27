// ==============================================================================
// AssetVault: AI Intelligence & Conversational Voice Routes (/api/ai/*)
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import { aiController } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';

const router = Router();

router.use(authenticate, loadUser, tenantContext);

router.get('/context-summary', aiController.getContextSummary);
router.post('/optimize', aiController.runOptimizationAudit);
router.post('/copilot', aiController.askCopilot);
router.post('/chat', aiController.askCopilot);
router.post('/extract-contract', aiController.extractContract);
router.post('/draft-email', aiController.draftEmail);

export default router;
