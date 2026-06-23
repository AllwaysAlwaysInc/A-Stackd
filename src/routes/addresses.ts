import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { parseShippingAddress } from "../domain/address.js";
import { ShippingAddressSchema } from "../schemas.js";
import type { DataStore } from "../store/types.js";

const CreateAddressBody = Type.Object({
  address: ShippingAddressSchema,
  isDefault: Type.Boolean(),
});

export function addressRoutes(store: DataStore, blockedStates: Set<string> = new Set()) {
  return async function (fastify: FastifyInstance) {
    const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

    app.get(
      "/addresses",
      async (request) => {
        const addresses = await store.listAddresses(request.userId);
        return { addresses };
      }
    );

    app.post(
      "/addresses",
      { schema: { body: CreateAddressBody } },
      async (request) => {
        const { address, isDefault } = request.body;
        const parsed = parseShippingAddress(address, blockedStates);

        const newAddr = await store.createAddress(request.userId, parsed, isDefault);
        return { success: true, address: newAddr };
      }
    );

    app.delete(
      "/addresses/:addressId",
      { schema: { params: Type.Object({ addressId: Type.String() }) } },
      async (request) => {
        await store.deleteAddress(request.userId, request.params.addressId);
        return { success: true };
      }
    );
  };
}
