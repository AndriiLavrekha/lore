import { describe, expect, it } from "vitest";

import {
  getServiceConstructor,
  loadProtoPackageDefinition,
  PROTO_FILE_PATHS,
  PROTO_LOADER_OPTIONS,
} from "@/server/grpc/clients";

describe("grpc proto clients", () => {
  it("loads all required Lore and URC service constructors", () => {
    const definition = loadProtoPackageDefinition();

    expect(PROTO_FILE_PATHS).toContain("lore/repository/v1/repository.proto");
    expect(PROTO_LOADER_OPTIONS.longs).toBe(String);
    expect(getServiceConstructor(definition, "lore.repository.v1.RepositoryService")).toBeTypeOf(
      "function",
    );
    expect(getServiceConstructor(definition, "lore.revision.v1.RevisionService")).toBeTypeOf(
      "function",
    );
    expect(getServiceConstructor(definition, "lore.thin_client.v1.ThinClientService")).toBeTypeOf(
      "function",
    );
    expect(getServiceConstructor(definition, "lore.storage.v1.StorageService")).toBeTypeOf(
      "function",
    );
    expect(getServiceConstructor(definition, "lore.environment.v1.EnvironmentService")).toBeTypeOf(
      "function",
    );
    expect(getServiceConstructor(definition, "urc.lock.LockService")).toBeTypeOf("function");
    expect(getServiceConstructor(definition, "urc.notification.NotificationService")).toBeTypeOf(
      "function",
    );
    expect(getServiceConstructor(definition, "urc.rpc.AdminService")).toBeTypeOf("function");
  });
});
