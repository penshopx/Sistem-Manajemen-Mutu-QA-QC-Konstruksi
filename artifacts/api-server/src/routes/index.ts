import { Router, type IRouter } from "express";
import healthRouter from "./health";
import workspaceRouter from "./workspace";
import operationsRouter from "./operations";
import materialsRouter from "./materials";

const router: IRouter = Router();

router.use(healthRouter);
router.use(operationsRouter);
router.use(workspaceRouter);
router.use(materialsRouter);

export default router;
