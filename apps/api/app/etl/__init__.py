from .contracts import (
    CONTRACT_VERSION,
    ArchiveLocator,
    ContractVersionMismatch,
    ExtractorPlugin,
    LoaderIntent,
    LoaderIntentType,
    NormalizedDocument,
    NormalizedSection,
    PluginCapability,
    PluginFailure,
    PluginFailureCategory,
    PluginMetadata,
    PluginRegistry,
    PluginResult,
    SourcePlugin,
    TransformerPlugin,
    normalize_document,
    normalize_metadata,
    normalize_section,
    serialize_loader_intent,
    serialize_normalized_document,
    serialize_normalized_section,
    serialize_plugin_failure,
    serialize_plugin_result,
)


_LAZY_EXPORTS = {
    "DdbArtifactLoadService": (".load_services", "DdbArtifactLoadService"),
    "DirectSequentialEtlRunner": (".runner", "DirectSequentialEtlRunner"),
    "EtlEmptyOutputError": (".runner", "EtlEmptyOutputError"),
    "EtlPluginFailure": (".runner", "EtlPluginFailure"),
    "EtlPluginUnexpectedError": (".runner", "EtlPluginUnexpectedError"),
    "EtlRunnerError": (".runner", "EtlRunnerError"),
    "PostgresLoadService": (".load_services", "PostgresLoadService"),
    "QdrantLoadService": (".load_services", "QdrantLoadService"),
    "SequentialEtlState": (".runner", "SequentialEtlState"),
    "normalized_document_from_parsed": (".ingestion_compat", "normalized_document_from_parsed"),
    "normalized_section_from_parsed": (".ingestion_compat", "normalized_section_from_parsed"),
    "parsed_document_from_normalized": (".ingestion_compat", "parsed_document_from_normalized"),
    "parsed_section_from_normalized": (".ingestion_compat", "parsed_section_from_normalized"),
}

__all__ = [
    "CONTRACT_VERSION",
    "ArchiveLocator",
    "ContractVersionMismatch",
    "DdbArtifactLoadService",
    "DirectSequentialEtlRunner",
    "EtlEmptyOutputError",
    "EtlPluginFailure",
    "EtlPluginUnexpectedError",
    "EtlRunnerError",
    "ExtractorPlugin",
    "LoaderIntent",
    "LoaderIntentType",
    "NormalizedDocument",
    "NormalizedSection",
    "PluginCapability",
    "PluginFailure",
    "PluginFailureCategory",
    "PluginMetadata",
    "PluginRegistry",
    "PluginResult",
    "PostgresLoadService",
    "QdrantLoadService",
    "SourcePlugin",
    "SequentialEtlState",
    "TransformerPlugin",
    "normalize_document",
    "normalize_metadata",
    "normalize_section",
    "normalized_document_from_parsed",
    "normalized_section_from_parsed",
    "parsed_document_from_normalized",
    "parsed_section_from_normalized",
    "serialize_loader_intent",
    "serialize_normalized_document",
    "serialize_normalized_section",
    "serialize_plugin_failure",
    "serialize_plugin_result",
]


def __getattr__(name: str) -> object:
    export = _LAZY_EXPORTS.get(name)
    if export is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    from importlib import import_module

    module_name, attr_name = export
    value = getattr(import_module(module_name, __name__), attr_name)
    globals()[name] = value
    return value
