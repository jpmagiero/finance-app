import { idSchema } from "@finance/shared";
import { z } from "zod";

// Enquanto nao ha autenticacao, o escopo de household vem explicito na query
// de toda rota por :id — os services validam que o registro pertence a casa.
export const idParamsSchema = z.object({ id: idSchema });
export const householdQuerySchema = z.object({ householdId: idSchema });
export const householdParamsSchema = z.object({ householdId: idSchema });

// Resposta 204 dos DELETEs: sem declarar, o swagger publicaria um
// "200 Default Response" que nao existe em runtime.
export const noContentResponseSchema = z.null().describe("Sem conteudo");
