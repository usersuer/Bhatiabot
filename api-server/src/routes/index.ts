 import { Router, type IRouter } from "express";
import healthRouter from "./health";
import traderspostRouter from "./traderspost";

const router: IRouter = Router();

router.use(healthRouter);
router.use(traderspostRouter);

export default router;
