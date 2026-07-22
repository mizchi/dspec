module dspec_self

abstract sig Rule {}
abstract sig ActiveApprovedRule extends Rule {}
abstract sig DeprecatedRule extends Rule {}
abstract sig CheckTarget {}
abstract sig AutomatedCheckTarget extends CheckTarget {}
abstract sig ManualCheckTarget extends CheckTarget {}

one sig R_DSPEC_APP_PROFILE extends ActiveApprovedRule {}
one sig R_DSPEC_ASSURANCE_EVIDENCE_MANIFEST extends ActiveApprovedRule {}
one sig R_DSPEC_AUTHORING_SHORTHAND extends ActiveApprovedRule {}
one sig R_DSPEC_BACKEND_PROJECTION_OWNERSHIP extends ActiveApprovedRule {}
one sig R_DSPEC_BACKEND_REPORT_COMPAT_FIXTURES extends ActiveApprovedRule {}
one sig R_DSPEC_CHECK_APPROVED_VERIFIED extends ActiveApprovedRule {}
one sig R_DSPEC_CHECK_ASSURANCE extends ActiveApprovedRule {}
one sig R_DSPEC_CHECK_CONTRADICTION extends ActiveApprovedRule {}
one sig R_DSPEC_CHECK_DRIFT_COVERAGE_JSON extends ActiveApprovedRule {}
one sig R_DSPEC_CHECK_DUPLICATES extends ActiveApprovedRule {}
one sig R_DSPEC_CHECK_REFERENCES extends ActiveApprovedRule {}
one sig R_DSPEC_CLOUD_TOPOLOGY_PATTERN extends ActiveApprovedRule {}
one sig R_DSPEC_COUNTEREXAMPLE_NORMALIZED extends ActiveApprovedRule {}
one sig R_DSPEC_COVERAGE_APPROVED_CHECKED extends ActiveApprovedRule {}
one sig R_DSPEC_COVERAGE_CLAUSE_QUALITY extends ActiveApprovedRule {}
one sig R_DSPEC_DAILY_DRIFT_REVIEW extends ActiveApprovedRule {}
one sig R_DSPEC_DATA_GOVERNANCE_PATTERN extends ActiveApprovedRule {}
one sig R_DSPEC_DB_MIGRATION_MAPPING_COVERAGE extends ActiveApprovedRule {}
one sig R_DSPEC_DB_MIGRATION_MAPPING_WELL_FORMED extends ActiveApprovedRule {}
one sig R_DSPEC_DB_MIGRATION_PATTERN extends ActiveApprovedRule {}
one sig R_DSPEC_DB_MODEL_PATTERN extends ActiveApprovedRule {}
one sig R_DSPEC_DB_SCHEMA_IMPORTER extends ActiveApprovedRule {}
one sig R_DSPEC_DOCUMENTED_CLI_EXAMPLES extends ActiveApprovedRule {}
one sig R_DSPEC_DOGFOOD_TASK extends ActiveApprovedRule {}
one sig R_DSPEC_DOMAIN_COVERAGE_ORACLE extends ActiveApprovedRule {}
one sig R_DSPEC_DOMAIN_MODEL_FORMALIZATION_AND_CODEGEN extends ActiveApprovedRule {}
one sig R_DSPEC_DOMAIN_PRESET_PACK extends ActiveApprovedRule {}
one sig R_DSPEC_DRIFT_CHECK_TARGET extends ActiveApprovedRule {}
one sig R_DSPEC_DRIFT_IMPLEMENTATION_REF extends ActiveApprovedRule {}
one sig R_DSPEC_EMIT_FORMAL_BACKENDS extends ActiveApprovedRule {}
one sig R_DSPEC_EMIT_MARKDOWN extends ActiveApprovedRule {}
one sig R_DSPEC_EMIT_QUICKCHECK extends ActiveApprovedRule {}
one sig R_DSPEC_EXPR_AST_PROJECTION extends ActiveApprovedRule {}
one sig R_DSPEC_EXPR_OPAQUE extends ActiveApprovedRule {}
one sig R_DSPEC_EXPR_TYPED_AST extends ActiveApprovedRule {}
one sig R_DSPEC_FORMAL_SOURCE_OF_TRUTH extends ActiveApprovedRule {}
one sig R_DSPEC_GENERATED_ALLOY_SYNTAX extends ActiveApprovedRule {}
one sig R_DSPEC_GENERATED_ARTIFACT_FRESHNESS extends ActiveApprovedRule {}
one sig R_DSPEC_GENERATED_CHECKS_LOAD_BEARING extends ActiveApprovedRule {}
one sig R_DSPEC_GENERATED_LEAN_COMPILES extends ActiveApprovedRule {}
one sig R_DSPEC_GENERATED_QUICKCHECK_RUNS extends ActiveApprovedRule {}
one sig R_DSPEC_GENERATED_TLA_SYNTAX extends ActiveApprovedRule {}
one sig R_DSPEC_I18N_RENDER extends ActiveApprovedRule {}
one sig R_DSPEC_I18N_SEMANTIC_DRIFT extends ActiveApprovedRule {}
one sig R_DSPEC_IMPLEMENTATION_CONFORMANCE extends ActiveApprovedRule {}
one sig R_DSPEC_INTENT_CLOSED_CONSTRUCTION extends ActiveApprovedRule {}
one sig R_DSPEC_INTENT_GOAL_GRAPH extends ActiveApprovedRule {}
one sig R_DSPEC_INTENT_PROTOCOL_TEST_ORACLE extends ActiveApprovedRule {}
one sig R_DSPEC_JSON_REPORT_COMPAT_FIXTURES extends ActiveApprovedRule {}
one sig R_DSPEC_LEAN_EQ_SEMANTIC extends ActiveApprovedRule {}
one sig R_DSPEC_MARKDOWN_REVIEW_ARTIFACT extends ActiveApprovedRule {}
one sig R_DSPEC_MBT_BOUNDARY extends Rule {}
one sig R_DSPEC_NIX_CI_GATE extends ActiveApprovedRule {}
one sig R_DSPEC_NIX_FORMAL_TOOLS extends ActiveApprovedRule {}
one sig R_DSPEC_PACKAGE_RELEASE extends ActiveApprovedRule {}
one sig R_DSPEC_PRODUCT_POSITIONING extends ActiveApprovedRule {}
one sig R_DSPEC_REAL_APP_DOGFOOD extends ActiveApprovedRule {}
one sig R_DSPEC_REAL_APP_IMPORTER extends ActiveApprovedRule {}
one sig R_DSPEC_REAL_APP_RECONCILIATION extends ActiveApprovedRule {}
one sig R_DSPEC_REAL_APP_REVERSE_COVERAGE extends ActiveApprovedRule {}
one sig R_DSPEC_RELEASE_SAFETY_PATTERN extends ActiveApprovedRule {}
one sig R_DSPEC_RUNTIME_COLLECTOR_FIXTURE extends ActiveApprovedRule {}
one sig R_DSPEC_RUNTIME_COLLECTOR_MANIFEST extends ActiveApprovedRule {}
one sig R_DSPEC_RUNTIME_EVIDENCE_COLLECTOR extends ActiveApprovedRule {}
one sig R_DSPEC_RUNTIME_EVIDENCE_IMPORTER extends ActiveApprovedRule {}
one sig R_DSPEC_RUNTIME_EVIDENCE_PATTERN extends ActiveApprovedRule {}
one sig R_DSPEC_RUNTIME_EVIDENCE_VERIFIER extends ActiveApprovedRule {}
one sig R_DSPEC_RUNTIME_SAFETY_PATTERN extends ActiveApprovedRule {}
one sig R_DSPEC_SCHEMA_TYPED extends ActiveApprovedRule {}
one sig R_DSPEC_SEMANTICS_INFERENTIAL_SUPPORT extends Rule {}
one sig R_DSPEC_SOURCE_MAP_GENERATED extends ActiveApprovedRule {}
one sig R_DSPEC_SPEC_CHANGE_REVIEW extends ActiveApprovedRule {}
one sig R_DSPEC_SPEC_CHANGE_REVIEW_SCAFFOLD extends ActiveApprovedRule {}
one sig R_DSPEC_SPEC_COMPAT_CLASSIFIER extends ActiveApprovedRule {}
one sig R_DSPEC_SPEC_DIFF_IMPACT extends ActiveApprovedRule {}
one sig R_DSPEC_SPEC_QUERY extends ActiveApprovedRule {}
one sig R_DSPEC_SPEC_READING_EVAL extends ActiveApprovedRule {}
one sig R_DSPEC_SQL_QUERY_ORACLE extends ActiveApprovedRule {}
one sig R_DSPEC_STABLE_IDS extends ActiveApprovedRule {}
one sig R_DSPEC_TOPLEVEL_MODEL extends ActiveApprovedRule {}
one sig R_DSPEC_VERIFY_GENERATED_JSON extends ActiveApprovedRule {}

one sig C_0_0 extends AutomatedCheckTarget {}
one sig C_0_1 extends AutomatedCheckTarget {}
one sig C_0_2 extends AutomatedCheckTarget {}
one sig C_0_3 extends AutomatedCheckTarget {}
one sig C_0_4 extends AutomatedCheckTarget {}
one sig C_0_5 extends AutomatedCheckTarget {}
one sig C_0_6 extends AutomatedCheckTarget {}
one sig C_0_7 extends AutomatedCheckTarget {}
one sig C_0_8 extends AutomatedCheckTarget {}
one sig C_0_9 extends AutomatedCheckTarget {}
one sig C_0_10 extends AutomatedCheckTarget {}
one sig C_0_11 extends AutomatedCheckTarget {}
one sig C_0_12 extends AutomatedCheckTarget {}
one sig C_0_13 extends AutomatedCheckTarget {}
one sig C_0_14 extends AutomatedCheckTarget {}
one sig C_0_15 extends AutomatedCheckTarget {}
one sig C_0_16 extends AutomatedCheckTarget {}
one sig C_0_17 extends AutomatedCheckTarget {}
one sig C_0_18 extends AutomatedCheckTarget {}
one sig C_0_19 extends AutomatedCheckTarget {}
one sig C_0_20 extends AutomatedCheckTarget {}
one sig C_0_21 extends AutomatedCheckTarget {}
one sig C_0_22 extends AutomatedCheckTarget {}
one sig C_0_23 extends AutomatedCheckTarget {}
one sig C_0_24 extends AutomatedCheckTarget {}
one sig C_0_25 extends AutomatedCheckTarget {}
one sig C_0_26 extends AutomatedCheckTarget {}
one sig C_0_27 extends AutomatedCheckTarget {}
one sig C_0_28 extends AutomatedCheckTarget {}
one sig C_0_29 extends AutomatedCheckTarget {}
one sig C_0_30 extends AutomatedCheckTarget {}
one sig C_0_31 extends AutomatedCheckTarget {}
one sig C_0_32 extends AutomatedCheckTarget {}
one sig C_0_33 extends AutomatedCheckTarget {}
one sig C_0_34 extends AutomatedCheckTarget {}
one sig C_0_35 extends AutomatedCheckTarget {}
one sig C_0_36 extends AutomatedCheckTarget {}
one sig C_0_37 extends AutomatedCheckTarget {}
one sig C_0_38 extends AutomatedCheckTarget {}
one sig C_0_39 extends AutomatedCheckTarget {}
one sig C_0_40 extends AutomatedCheckTarget {}
one sig C_1_0 extends AutomatedCheckTarget {}
one sig C_1_1 extends AutomatedCheckTarget {}
one sig C_1_2 extends AutomatedCheckTarget {}
one sig C_1_3 extends AutomatedCheckTarget {}
one sig C_2_0 extends AutomatedCheckTarget {}
one sig C_3_0 extends AutomatedCheckTarget {}
one sig C_3_1 extends AutomatedCheckTarget {}
one sig C_3_2 extends AutomatedCheckTarget {}
one sig C_3_3 extends AutomatedCheckTarget {}
one sig C_3_4 extends AutomatedCheckTarget {}
one sig C_4_0 extends AutomatedCheckTarget {}
one sig C_4_1 extends AutomatedCheckTarget {}
one sig C_5_0 extends AutomatedCheckTarget {}
one sig C_6_0 extends AutomatedCheckTarget {}
one sig C_6_1 extends AutomatedCheckTarget {}
one sig C_6_2 extends AutomatedCheckTarget {}
one sig C_6_3 extends AutomatedCheckTarget {}
one sig C_6_4 extends AutomatedCheckTarget {}
one sig C_6_5 extends AutomatedCheckTarget {}
one sig C_6_6 extends AutomatedCheckTarget {}
one sig C_7_0 extends AutomatedCheckTarget {}
one sig C_7_1 extends AutomatedCheckTarget {}
one sig C_8_0 extends AutomatedCheckTarget {}
one sig C_8_1 extends AutomatedCheckTarget {}
one sig C_8_2 extends AutomatedCheckTarget {}
one sig C_8_3 extends AutomatedCheckTarget {}
one sig C_8_4 extends AutomatedCheckTarget {}
one sig C_8_5 extends AutomatedCheckTarget {}
one sig C_8_6 extends AutomatedCheckTarget {}
one sig C_8_7 extends AutomatedCheckTarget {}
one sig C_9_0 extends AutomatedCheckTarget {}
one sig C_10_0 extends AutomatedCheckTarget {}
one sig C_11_0 extends AutomatedCheckTarget {}
one sig C_11_1 extends AutomatedCheckTarget {}
one sig C_11_2 extends AutomatedCheckTarget {}
one sig C_11_3 extends AutomatedCheckTarget {}
one sig C_11_4 extends AutomatedCheckTarget {}
one sig C_12_0 extends AutomatedCheckTarget {}
one sig C_12_1 extends AutomatedCheckTarget {}
one sig C_13_0 extends AutomatedCheckTarget {}
one sig C_13_1 extends AutomatedCheckTarget {}
one sig C_14_0 extends AutomatedCheckTarget {}
one sig C_14_1 extends AutomatedCheckTarget {}
one sig C_14_2 extends AutomatedCheckTarget {}
one sig C_15_0 extends AutomatedCheckTarget {}
one sig C_15_1 extends AutomatedCheckTarget {}
one sig C_15_2 extends AutomatedCheckTarget {}
one sig C_15_3 extends AutomatedCheckTarget {}
one sig C_15_4 extends AutomatedCheckTarget {}
one sig C_15_5 extends AutomatedCheckTarget {}
one sig C_15_6 extends AutomatedCheckTarget {}
one sig C_15_7 extends AutomatedCheckTarget {}
one sig C_16_0 extends AutomatedCheckTarget {}
one sig C_16_1 extends AutomatedCheckTarget {}
one sig C_16_2 extends AutomatedCheckTarget {}
one sig C_16_3 extends AutomatedCheckTarget {}
one sig C_16_4 extends AutomatedCheckTarget {}
one sig C_17_0 extends AutomatedCheckTarget {}
one sig C_17_1 extends AutomatedCheckTarget {}
one sig C_17_2 extends AutomatedCheckTarget {}
one sig C_17_3 extends AutomatedCheckTarget {}
one sig C_18_0 extends AutomatedCheckTarget {}
one sig C_18_1 extends AutomatedCheckTarget {}
one sig C_18_2 extends AutomatedCheckTarget {}
one sig C_18_3 extends AutomatedCheckTarget {}
one sig C_19_0 extends AutomatedCheckTarget {}
one sig C_19_1 extends AutomatedCheckTarget {}
one sig C_19_2 extends AutomatedCheckTarget {}
one sig C_19_3 extends AutomatedCheckTarget {}
one sig C_20_0 extends AutomatedCheckTarget {}
one sig C_20_1 extends AutomatedCheckTarget {}
one sig C_20_2 extends AutomatedCheckTarget {}
one sig C_21_0 extends AutomatedCheckTarget {}
one sig C_21_1 extends AutomatedCheckTarget {}
one sig C_22_0 extends AutomatedCheckTarget {}
one sig C_22_1 extends AutomatedCheckTarget {}
one sig C_22_2 extends AutomatedCheckTarget {}
one sig C_22_3 extends AutomatedCheckTarget {}
one sig C_23_0 extends AutomatedCheckTarget {}
one sig C_24_0 extends AutomatedCheckTarget {}
one sig C_24_1 extends AutomatedCheckTarget {}
one sig C_24_2 extends AutomatedCheckTarget {}
one sig C_24_3 extends AutomatedCheckTarget {}
one sig C_25_0 extends AutomatedCheckTarget {}
one sig C_25_1 extends AutomatedCheckTarget {}
one sig C_25_2 extends AutomatedCheckTarget {}
one sig C_26_0 extends AutomatedCheckTarget {}
one sig C_26_1 extends AutomatedCheckTarget {}
one sig C_26_2 extends AutomatedCheckTarget {}
one sig C_26_3 extends AutomatedCheckTarget {}
one sig C_26_4 extends AutomatedCheckTarget {}
one sig C_26_5 extends AutomatedCheckTarget {}
one sig C_27_0 extends AutomatedCheckTarget {}
one sig C_27_1 extends AutomatedCheckTarget {}
one sig C_27_2 extends AutomatedCheckTarget {}
one sig C_28_0 extends AutomatedCheckTarget {}
one sig C_29_0 extends AutomatedCheckTarget {}
one sig C_30_0 extends AutomatedCheckTarget {}
one sig C_31_0 extends AutomatedCheckTarget {}
one sig C_32_0 extends AutomatedCheckTarget {}
one sig C_33_0 extends AutomatedCheckTarget {}
one sig C_34_0 extends AutomatedCheckTarget {}
one sig C_34_1 extends AutomatedCheckTarget {}
one sig C_34_2 extends AutomatedCheckTarget {}
one sig C_34_3 extends AutomatedCheckTarget {}
one sig C_34_4 extends AutomatedCheckTarget {}
one sig C_34_5 extends AutomatedCheckTarget {}
one sig C_34_6 extends AutomatedCheckTarget {}
one sig C_35_0 extends AutomatedCheckTarget {}
one sig C_36_0 extends AutomatedCheckTarget {}
one sig C_36_1 extends AutomatedCheckTarget {}
one sig C_37_0 extends AutomatedCheckTarget {}
one sig C_37_1 extends AutomatedCheckTarget {}
one sig C_38_0 extends AutomatedCheckTarget {}
one sig C_39_0 extends AutomatedCheckTarget {}
one sig C_40_0 extends AutomatedCheckTarget {}
one sig C_41_0 extends AutomatedCheckTarget {}
one sig C_41_1 extends AutomatedCheckTarget {}
one sig C_41_2 extends AutomatedCheckTarget {}
one sig C_42_0 extends AutomatedCheckTarget {}
one sig C_43_0 extends AutomatedCheckTarget {}
one sig C_43_1 extends AutomatedCheckTarget {}
one sig C_43_2 extends AutomatedCheckTarget {}
one sig C_43_3 extends AutomatedCheckTarget {}
one sig C_44_0 extends AutomatedCheckTarget {}
one sig C_44_1 extends AutomatedCheckTarget {}
one sig C_45_0 extends AutomatedCheckTarget {}
one sig C_46_0 extends AutomatedCheckTarget {}
one sig C_47_0 extends AutomatedCheckTarget {}
one sig C_47_1 extends AutomatedCheckTarget {}
one sig C_47_2 extends AutomatedCheckTarget {}
one sig C_48_0 extends AutomatedCheckTarget {}
one sig C_48_1 extends AutomatedCheckTarget {}
one sig C_48_2 extends AutomatedCheckTarget {}
one sig C_48_3 extends AutomatedCheckTarget {}
one sig C_48_4 extends AutomatedCheckTarget {}
one sig C_48_5 extends AutomatedCheckTarget {}
one sig C_48_6 extends AutomatedCheckTarget {}
one sig C_48_7 extends AutomatedCheckTarget {}
one sig C_48_8 extends AutomatedCheckTarget {}
one sig C_48_9 extends AutomatedCheckTarget {}
one sig C_48_10 extends AutomatedCheckTarget {}
one sig C_48_11 extends AutomatedCheckTarget {}
one sig C_48_12 extends AutomatedCheckTarget {}
one sig C_48_13 extends AutomatedCheckTarget {}
one sig C_48_14 extends AutomatedCheckTarget {}
one sig C_48_15 extends AutomatedCheckTarget {}
one sig C_48_16 extends AutomatedCheckTarget {}
one sig C_48_17 extends AutomatedCheckTarget {}
one sig C_48_18 extends AutomatedCheckTarget {}
one sig C_48_19 extends AutomatedCheckTarget {}
one sig C_48_20 extends AutomatedCheckTarget {}
one sig C_48_21 extends AutomatedCheckTarget {}
one sig C_48_22 extends AutomatedCheckTarget {}
one sig C_48_23 extends AutomatedCheckTarget {}
one sig C_48_24 extends AutomatedCheckTarget {}
one sig C_48_25 extends AutomatedCheckTarget {}
one sig C_48_26 extends AutomatedCheckTarget {}
one sig C_48_27 extends AutomatedCheckTarget {}
one sig C_48_28 extends AutomatedCheckTarget {}
one sig C_48_29 extends AutomatedCheckTarget {}
one sig C_48_30 extends AutomatedCheckTarget {}
one sig C_49_0 extends AutomatedCheckTarget {}
one sig C_49_1 extends AutomatedCheckTarget {}
one sig C_49_2 extends AutomatedCheckTarget {}
one sig C_49_3 extends AutomatedCheckTarget {}
one sig C_49_4 extends AutomatedCheckTarget {}
one sig C_50_0 extends AutomatedCheckTarget {}
one sig C_50_1 extends AutomatedCheckTarget {}
one sig C_50_2 extends AutomatedCheckTarget {}
one sig C_50_3 extends AutomatedCheckTarget {}
one sig C_50_4 extends AutomatedCheckTarget {}
one sig C_50_5 extends AutomatedCheckTarget {}
one sig C_50_6 extends AutomatedCheckTarget {}
one sig C_50_7 extends AutomatedCheckTarget {}
one sig C_50_8 extends AutomatedCheckTarget {}
one sig C_50_9 extends AutomatedCheckTarget {}
one sig C_50_10 extends AutomatedCheckTarget {}
one sig C_50_11 extends AutomatedCheckTarget {}
one sig C_50_12 extends AutomatedCheckTarget {}
one sig C_50_13 extends AutomatedCheckTarget {}
one sig C_50_14 extends AutomatedCheckTarget {}
one sig C_50_15 extends AutomatedCheckTarget {}
one sig C_50_16 extends AutomatedCheckTarget {}
one sig C_50_17 extends AutomatedCheckTarget {}
one sig C_50_18 extends AutomatedCheckTarget {}
one sig C_50_19 extends AutomatedCheckTarget {}
one sig C_50_20 extends AutomatedCheckTarget {}
one sig C_50_21 extends AutomatedCheckTarget {}
one sig C_50_22 extends AutomatedCheckTarget {}
one sig C_50_23 extends AutomatedCheckTarget {}
one sig C_50_24 extends AutomatedCheckTarget {}
one sig C_52_0 extends AutomatedCheckTarget {}
one sig C_53_0 extends AutomatedCheckTarget {}
one sig C_53_1 extends AutomatedCheckTarget {}
one sig C_53_2 extends AutomatedCheckTarget {}
one sig C_54_0 extends AutomatedCheckTarget {}
one sig C_54_1 extends AutomatedCheckTarget {}
one sig C_54_2 extends AutomatedCheckTarget {}
one sig C_55_0 extends AutomatedCheckTarget {}
one sig C_56_0 extends AutomatedCheckTarget {}
one sig C_57_0 extends AutomatedCheckTarget {}
one sig C_57_1 extends AutomatedCheckTarget {}
one sig C_57_2 extends AutomatedCheckTarget {}
one sig C_57_3 extends AutomatedCheckTarget {}
one sig C_57_4 extends AutomatedCheckTarget {}
one sig C_57_5 extends AutomatedCheckTarget {}
one sig C_57_6 extends AutomatedCheckTarget {}
one sig C_57_7 extends AutomatedCheckTarget {}
one sig C_57_8 extends AutomatedCheckTarget {}
one sig C_57_9 extends AutomatedCheckTarget {}
one sig C_57_10 extends AutomatedCheckTarget {}
one sig C_57_11 extends AutomatedCheckTarget {}
one sig C_58_0 extends AutomatedCheckTarget {}
one sig C_58_1 extends AutomatedCheckTarget {}
one sig C_58_2 extends AutomatedCheckTarget {}
one sig C_58_3 extends AutomatedCheckTarget {}
one sig C_59_0 extends AutomatedCheckTarget {}
one sig C_59_1 extends AutomatedCheckTarget {}
one sig C_60_0 extends AutomatedCheckTarget {}
one sig C_60_1 extends AutomatedCheckTarget {}
one sig C_60_2 extends AutomatedCheckTarget {}
one sig C_60_3 extends AutomatedCheckTarget {}
one sig C_60_4 extends AutomatedCheckTarget {}
one sig C_61_0 extends AutomatedCheckTarget {}
one sig C_62_0 extends AutomatedCheckTarget {}
one sig C_62_1 extends AutomatedCheckTarget {}
one sig C_63_0 extends AutomatedCheckTarget {}
one sig C_63_1 extends AutomatedCheckTarget {}
one sig C_63_2 extends AutomatedCheckTarget {}
one sig C_63_3 extends AutomatedCheckTarget {}
one sig C_64_0 extends AutomatedCheckTarget {}
one sig C_64_1 extends AutomatedCheckTarget {}
one sig C_64_2 extends AutomatedCheckTarget {}
one sig C_65_0 extends AutomatedCheckTarget {}
one sig C_65_1 extends AutomatedCheckTarget {}
one sig C_65_2 extends AutomatedCheckTarget {}
one sig C_65_3 extends AutomatedCheckTarget {}
one sig C_66_0 extends AutomatedCheckTarget {}
one sig C_66_1 extends AutomatedCheckTarget {}
one sig C_66_2 extends AutomatedCheckTarget {}
one sig C_66_3 extends AutomatedCheckTarget {}
one sig C_67_0 extends AutomatedCheckTarget {}
one sig C_67_1 extends AutomatedCheckTarget {}
one sig C_67_2 extends AutomatedCheckTarget {}
one sig C_67_3 extends AutomatedCheckTarget {}
one sig C_67_4 extends AutomatedCheckTarget {}
one sig C_68_0 extends AutomatedCheckTarget {}
one sig C_70_0 extends AutomatedCheckTarget {}
one sig C_70_1 extends AutomatedCheckTarget {}
one sig C_71_0 extends AutomatedCheckTarget {}
one sig C_71_1 extends AutomatedCheckTarget {}
one sig C_71_2 extends AutomatedCheckTarget {}
one sig C_71_3 extends AutomatedCheckTarget {}
one sig C_71_4 extends AutomatedCheckTarget {}
one sig C_71_5 extends AutomatedCheckTarget {}
one sig C_71_6 extends AutomatedCheckTarget {}
one sig C_71_7 extends AutomatedCheckTarget {}
one sig C_71_8 extends AutomatedCheckTarget {}
one sig C_71_9 extends AutomatedCheckTarget {}
one sig C_71_10 extends AutomatedCheckTarget {}
one sig C_72_0 extends AutomatedCheckTarget {}
one sig C_72_1 extends AutomatedCheckTarget {}
one sig C_72_2 extends AutomatedCheckTarget {}
one sig C_72_3 extends AutomatedCheckTarget {}
one sig C_72_4 extends AutomatedCheckTarget {}
one sig C_72_5 extends AutomatedCheckTarget {}
one sig C_72_6 extends AutomatedCheckTarget {}
one sig C_72_7 extends AutomatedCheckTarget {}
one sig C_72_8 extends AutomatedCheckTarget {}
one sig C_72_9 extends AutomatedCheckTarget {}
one sig C_72_10 extends AutomatedCheckTarget {}
one sig C_72_11 extends AutomatedCheckTarget {}
one sig C_72_12 extends AutomatedCheckTarget {}
one sig C_72_13 extends AutomatedCheckTarget {}
one sig C_73_0 extends AutomatedCheckTarget {}
one sig C_73_1 extends AutomatedCheckTarget {}
one sig C_73_2 extends AutomatedCheckTarget {}
one sig C_73_3 extends AutomatedCheckTarget {}
one sig C_74_0 extends AutomatedCheckTarget {}
one sig C_74_1 extends AutomatedCheckTarget {}
one sig C_74_2 extends AutomatedCheckTarget {}
one sig C_75_0 extends AutomatedCheckTarget {}
one sig C_75_1 extends AutomatedCheckTarget {}
one sig C_76_0 extends AutomatedCheckTarget {}
one sig C_76_1 extends AutomatedCheckTarget {}
one sig C_76_2 extends AutomatedCheckTarget {}
one sig C_76_3 extends AutomatedCheckTarget {}
one sig C_76_4 extends AutomatedCheckTarget {}
one sig C_76_5 extends AutomatedCheckTarget {}
one sig C_76_6 extends AutomatedCheckTarget {}
one sig C_76_7 extends AutomatedCheckTarget {}
one sig C_76_8 extends AutomatedCheckTarget {}
one sig C_76_9 extends AutomatedCheckTarget {}
one sig C_76_10 extends AutomatedCheckTarget {}
one sig C_76_11 extends AutomatedCheckTarget {}
one sig C_76_12 extends AutomatedCheckTarget {}
one sig C_76_13 extends AutomatedCheckTarget {}
one sig C_76_14 extends AutomatedCheckTarget {}
one sig C_76_15 extends AutomatedCheckTarget {}
one sig C_76_16 extends AutomatedCheckTarget {}
one sig C_76_17 extends AutomatedCheckTarget {}
one sig C_76_18 extends AutomatedCheckTarget {}
one sig C_76_19 extends AutomatedCheckTarget {}
one sig C_76_20 extends AutomatedCheckTarget {}
one sig C_76_21 extends AutomatedCheckTarget {}
one sig C_76_22 extends AutomatedCheckTarget {}
one sig C_76_23 extends AutomatedCheckTarget {}
one sig C_77_0 extends AutomatedCheckTarget {}
one sig C_77_1 extends AutomatedCheckTarget {}
one sig C_78_0 extends AutomatedCheckTarget {}
one sig C_79_0 extends AutomatedCheckTarget {}
one sig C_80_0 extends AutomatedCheckTarget {}

abstract sig IntentCapability {}
abstract sig IntentOutcome {}
abstract sig IntentProcess {}
abstract sig ConstructionAuthority {}
abstract sig IntentScenario {}
one sig IntentModel {
  intentCapabilities: set IntentCapability,
  intentOutcomes: set IntentOutcome,
  intentProcesses: set IntentProcess,
  constructionAuthorities: set ConstructionAuthority,
  intentScenarios: set IntentScenario,
  processOutcomes: IntentProcess -> set IntentOutcome,
  processConstructs: IntentProcess -> set IntentOutcome,
  authorisedConstruction: IntentProcess -> IntentOutcome
}
one sig IC_capability_dspec_validate extends IntentCapability {}
one sig IC_capability_pkl_typecheck extends IntentCapability {}
one sig IO_outcome_intent_model_accepted extends IntentOutcome {}
one sig IP_intent_validate_model extends IntentProcess {}
one sig ICA_intent_validate_model_accepts extends ConstructionAuthority {}
one sig ISC_intent_model_acceptance extends IntentScenario {}

fact GeneratedIntentModel {
  IntentModel.intentCapabilities = IC_capability_dspec_validate + IC_capability_pkl_typecheck
  IntentModel.intentOutcomes = IO_outcome_intent_model_accepted
  IntentModel.intentProcesses = IP_intent_validate_model
  IntentModel.constructionAuthorities = ICA_intent_validate_model_accepts
  IntentModel.intentScenarios = ISC_intent_model_acceptance
  IntentModel.processOutcomes = IP_intent_validate_model -> IO_outcome_intent_model_accepted
  IntentModel.processConstructs = IP_intent_validate_model -> IO_outcome_intent_model_accepted
  IntentModel.authorisedConstruction = IP_intent_validate_model -> IO_outcome_intent_model_accepted
}

assert IntentProcessConstructionIsAuthorized {
  IntentModel.processOutcomes = IntentModel.processConstructs
  IntentModel.processConstructs in IntentModel.authorisedConstruction
}
check IntentProcessConstructionIsAuthorized

one sig Model { checks: Rule -> set CheckTarget }

fact GeneratedChecks {
  Model.checks = R_DSPEC_APP_PROFILE -> C_0_0 + R_DSPEC_APP_PROFILE -> C_0_1 + R_DSPEC_APP_PROFILE -> C_0_2 + R_DSPEC_APP_PROFILE -> C_0_3 + R_DSPEC_APP_PROFILE -> C_0_4 + R_DSPEC_APP_PROFILE -> C_0_5 + R_DSPEC_APP_PROFILE -> C_0_6 + R_DSPEC_APP_PROFILE -> C_0_7 + R_DSPEC_APP_PROFILE -> C_0_8 + R_DSPEC_APP_PROFILE -> C_0_9 + R_DSPEC_APP_PROFILE -> C_0_10 + R_DSPEC_APP_PROFILE -> C_0_11 + R_DSPEC_APP_PROFILE -> C_0_12 + R_DSPEC_APP_PROFILE -> C_0_13 + R_DSPEC_APP_PROFILE -> C_0_14 + R_DSPEC_APP_PROFILE -> C_0_15 + R_DSPEC_APP_PROFILE -> C_0_16 + R_DSPEC_APP_PROFILE -> C_0_17 + R_DSPEC_APP_PROFILE -> C_0_18 + R_DSPEC_APP_PROFILE -> C_0_19 + R_DSPEC_APP_PROFILE -> C_0_20 + R_DSPEC_APP_PROFILE -> C_0_21 + R_DSPEC_APP_PROFILE -> C_0_22 + R_DSPEC_APP_PROFILE -> C_0_23 + R_DSPEC_APP_PROFILE -> C_0_24 + R_DSPEC_APP_PROFILE -> C_0_25 + R_DSPEC_APP_PROFILE -> C_0_26 + R_DSPEC_APP_PROFILE -> C_0_27 + R_DSPEC_APP_PROFILE -> C_0_28 + R_DSPEC_APP_PROFILE -> C_0_29 + R_DSPEC_APP_PROFILE -> C_0_30 + R_DSPEC_APP_PROFILE -> C_0_31 + R_DSPEC_APP_PROFILE -> C_0_32 + R_DSPEC_APP_PROFILE -> C_0_33 + R_DSPEC_APP_PROFILE -> C_0_34 + R_DSPEC_APP_PROFILE -> C_0_35 + R_DSPEC_APP_PROFILE -> C_0_36 + R_DSPEC_APP_PROFILE -> C_0_37 + R_DSPEC_APP_PROFILE -> C_0_38 + R_DSPEC_APP_PROFILE -> C_0_39 + R_DSPEC_APP_PROFILE -> C_0_40 + R_DSPEC_ASSURANCE_EVIDENCE_MANIFEST -> C_1_0 + R_DSPEC_ASSURANCE_EVIDENCE_MANIFEST -> C_1_1 + R_DSPEC_ASSURANCE_EVIDENCE_MANIFEST -> C_1_2 + R_DSPEC_ASSURANCE_EVIDENCE_MANIFEST -> C_1_3 + R_DSPEC_AUTHORING_SHORTHAND -> C_2_0 + R_DSPEC_BACKEND_PROJECTION_OWNERSHIP -> C_3_0 + R_DSPEC_BACKEND_PROJECTION_OWNERSHIP -> C_3_1 + R_DSPEC_BACKEND_PROJECTION_OWNERSHIP -> C_3_2 + R_DSPEC_BACKEND_PROJECTION_OWNERSHIP -> C_3_3 + R_DSPEC_BACKEND_PROJECTION_OWNERSHIP -> C_3_4 + R_DSPEC_BACKEND_REPORT_COMPAT_FIXTURES -> C_4_0 + R_DSPEC_BACKEND_REPORT_COMPAT_FIXTURES -> C_4_1 + R_DSPEC_CHECK_APPROVED_VERIFIED -> C_5_0 + R_DSPEC_CHECK_ASSURANCE -> C_6_0 + R_DSPEC_CHECK_ASSURANCE -> C_6_1 + R_DSPEC_CHECK_ASSURANCE -> C_6_2 + R_DSPEC_CHECK_ASSURANCE -> C_6_3 + R_DSPEC_CHECK_ASSURANCE -> C_6_4 + R_DSPEC_CHECK_ASSURANCE -> C_6_5 + R_DSPEC_CHECK_ASSURANCE -> C_6_6 + R_DSPEC_CHECK_CONTRADICTION -> C_7_0 + R_DSPEC_CHECK_CONTRADICTION -> C_7_1 + R_DSPEC_CHECK_DRIFT_COVERAGE_JSON -> C_8_0 + R_DSPEC_CHECK_DRIFT_COVERAGE_JSON -> C_8_1 + R_DSPEC_CHECK_DRIFT_COVERAGE_JSON -> C_8_2 + R_DSPEC_CHECK_DRIFT_COVERAGE_JSON -> C_8_3 + R_DSPEC_CHECK_DRIFT_COVERAGE_JSON -> C_8_4 + R_DSPEC_CHECK_DRIFT_COVERAGE_JSON -> C_8_5 + R_DSPEC_CHECK_DRIFT_COVERAGE_JSON -> C_8_6 + R_DSPEC_CHECK_DRIFT_COVERAGE_JSON -> C_8_7 + R_DSPEC_CHECK_DUPLICATES -> C_9_0 + R_DSPEC_CHECK_REFERENCES -> C_10_0 + R_DSPEC_CLOUD_TOPOLOGY_PATTERN -> C_11_0 + R_DSPEC_CLOUD_TOPOLOGY_PATTERN -> C_11_1 + R_DSPEC_CLOUD_TOPOLOGY_PATTERN -> C_11_2 + R_DSPEC_CLOUD_TOPOLOGY_PATTERN -> C_11_3 + R_DSPEC_CLOUD_TOPOLOGY_PATTERN -> C_11_4 + R_DSPEC_COUNTEREXAMPLE_NORMALIZED -> C_12_0 + R_DSPEC_COUNTEREXAMPLE_NORMALIZED -> C_12_1 + R_DSPEC_COVERAGE_APPROVED_CHECKED -> C_13_0 + R_DSPEC_COVERAGE_APPROVED_CHECKED -> C_13_1 + R_DSPEC_COVERAGE_CLAUSE_QUALITY -> C_14_0 + R_DSPEC_COVERAGE_CLAUSE_QUALITY -> C_14_1 + R_DSPEC_COVERAGE_CLAUSE_QUALITY -> C_14_2 + R_DSPEC_DAILY_DRIFT_REVIEW -> C_15_0 + R_DSPEC_DAILY_DRIFT_REVIEW -> C_15_1 + R_DSPEC_DAILY_DRIFT_REVIEW -> C_15_2 + R_DSPEC_DAILY_DRIFT_REVIEW -> C_15_3 + R_DSPEC_DAILY_DRIFT_REVIEW -> C_15_4 + R_DSPEC_DAILY_DRIFT_REVIEW -> C_15_5 + R_DSPEC_DAILY_DRIFT_REVIEW -> C_15_6 + R_DSPEC_DAILY_DRIFT_REVIEW -> C_15_7 + R_DSPEC_DATA_GOVERNANCE_PATTERN -> C_16_0 + R_DSPEC_DATA_GOVERNANCE_PATTERN -> C_16_1 + R_DSPEC_DATA_GOVERNANCE_PATTERN -> C_16_2 + R_DSPEC_DATA_GOVERNANCE_PATTERN -> C_16_3 + R_DSPEC_DATA_GOVERNANCE_PATTERN -> C_16_4 + R_DSPEC_DB_MIGRATION_MAPPING_COVERAGE -> C_17_0 + R_DSPEC_DB_MIGRATION_MAPPING_COVERAGE -> C_17_1 + R_DSPEC_DB_MIGRATION_MAPPING_COVERAGE -> C_17_2 + R_DSPEC_DB_MIGRATION_MAPPING_COVERAGE -> C_17_3 + R_DSPEC_DB_MIGRATION_MAPPING_WELL_FORMED -> C_18_0 + R_DSPEC_DB_MIGRATION_MAPPING_WELL_FORMED -> C_18_1 + R_DSPEC_DB_MIGRATION_MAPPING_WELL_FORMED -> C_18_2 + R_DSPEC_DB_MIGRATION_MAPPING_WELL_FORMED -> C_18_3 + R_DSPEC_DB_MIGRATION_PATTERN -> C_19_0 + R_DSPEC_DB_MIGRATION_PATTERN -> C_19_1 + R_DSPEC_DB_MIGRATION_PATTERN -> C_19_2 + R_DSPEC_DB_MIGRATION_PATTERN -> C_19_3 + R_DSPEC_DB_MODEL_PATTERN -> C_20_0 + R_DSPEC_DB_MODEL_PATTERN -> C_20_1 + R_DSPEC_DB_MODEL_PATTERN -> C_20_2 + R_DSPEC_DB_SCHEMA_IMPORTER -> C_21_0 + R_DSPEC_DB_SCHEMA_IMPORTER -> C_21_1 + R_DSPEC_DOCUMENTED_CLI_EXAMPLES -> C_22_0 + R_DSPEC_DOCUMENTED_CLI_EXAMPLES -> C_22_1 + R_DSPEC_DOCUMENTED_CLI_EXAMPLES -> C_22_2 + R_DSPEC_DOCUMENTED_CLI_EXAMPLES -> C_22_3 + R_DSPEC_DOGFOOD_TASK -> C_23_0 + R_DSPEC_DOMAIN_COVERAGE_ORACLE -> C_24_0 + R_DSPEC_DOMAIN_COVERAGE_ORACLE -> C_24_1 + R_DSPEC_DOMAIN_COVERAGE_ORACLE -> C_24_2 + R_DSPEC_DOMAIN_COVERAGE_ORACLE -> C_24_3 + R_DSPEC_DOMAIN_MODEL_FORMALIZATION_AND_CODEGEN -> C_25_0 + R_DSPEC_DOMAIN_MODEL_FORMALIZATION_AND_CODEGEN -> C_25_1 + R_DSPEC_DOMAIN_MODEL_FORMALIZATION_AND_CODEGEN -> C_25_2 + R_DSPEC_DOMAIN_PRESET_PACK -> C_26_0 + R_DSPEC_DOMAIN_PRESET_PACK -> C_26_1 + R_DSPEC_DOMAIN_PRESET_PACK -> C_26_2 + R_DSPEC_DOMAIN_PRESET_PACK -> C_26_3 + R_DSPEC_DOMAIN_PRESET_PACK -> C_26_4 + R_DSPEC_DOMAIN_PRESET_PACK -> C_26_5 + R_DSPEC_DRIFT_CHECK_TARGET -> C_27_0 + R_DSPEC_DRIFT_CHECK_TARGET -> C_27_1 + R_DSPEC_DRIFT_CHECK_TARGET -> C_27_2 + R_DSPEC_DRIFT_IMPLEMENTATION_REF -> C_28_0 + R_DSPEC_EMIT_FORMAL_BACKENDS -> C_29_0 + R_DSPEC_EMIT_MARKDOWN -> C_30_0 + R_DSPEC_EMIT_QUICKCHECK -> C_31_0 + R_DSPEC_EXPR_AST_PROJECTION -> C_32_0 + R_DSPEC_EXPR_OPAQUE -> C_33_0 + R_DSPEC_EXPR_TYPED_AST -> C_34_0 + R_DSPEC_EXPR_TYPED_AST -> C_34_1 + R_DSPEC_EXPR_TYPED_AST -> C_34_2 + R_DSPEC_EXPR_TYPED_AST -> C_34_3 + R_DSPEC_EXPR_TYPED_AST -> C_34_4 + R_DSPEC_EXPR_TYPED_AST -> C_34_5 + R_DSPEC_EXPR_TYPED_AST -> C_34_6 + R_DSPEC_FORMAL_SOURCE_OF_TRUTH -> C_35_0 + R_DSPEC_GENERATED_ALLOY_SYNTAX -> C_36_0 + R_DSPEC_GENERATED_ALLOY_SYNTAX -> C_36_1 + R_DSPEC_GENERATED_ARTIFACT_FRESHNESS -> C_37_0 + R_DSPEC_GENERATED_ARTIFACT_FRESHNESS -> C_37_1 + R_DSPEC_GENERATED_CHECKS_LOAD_BEARING -> C_38_0 + R_DSPEC_GENERATED_LEAN_COMPILES -> C_39_0 + R_DSPEC_GENERATED_QUICKCHECK_RUNS -> C_40_0 + R_DSPEC_GENERATED_TLA_SYNTAX -> C_41_0 + R_DSPEC_GENERATED_TLA_SYNTAX -> C_41_1 + R_DSPEC_GENERATED_TLA_SYNTAX -> C_41_2 + R_DSPEC_I18N_RENDER -> C_42_0 + R_DSPEC_I18N_SEMANTIC_DRIFT -> C_43_0 + R_DSPEC_I18N_SEMANTIC_DRIFT -> C_43_1 + R_DSPEC_I18N_SEMANTIC_DRIFT -> C_43_2 + R_DSPEC_I18N_SEMANTIC_DRIFT -> C_43_3 + R_DSPEC_IMPLEMENTATION_CONFORMANCE -> C_44_0 + R_DSPEC_IMPLEMENTATION_CONFORMANCE -> C_44_1 + R_DSPEC_INTENT_CLOSED_CONSTRUCTION -> C_45_0 + R_DSPEC_INTENT_GOAL_GRAPH -> C_46_0 + R_DSPEC_INTENT_PROTOCOL_TEST_ORACLE -> C_47_0 + R_DSPEC_INTENT_PROTOCOL_TEST_ORACLE -> C_47_1 + R_DSPEC_INTENT_PROTOCOL_TEST_ORACLE -> C_47_2 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_0 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_1 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_2 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_3 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_4 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_5 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_6 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_7 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_8 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_9 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_10 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_11 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_12 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_13 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_14 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_15 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_16 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_17 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_18 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_19 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_20 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_21 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_22 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_23 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_24 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_25 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_26 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_27 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_28 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_29 + R_DSPEC_JSON_REPORT_COMPAT_FIXTURES -> C_48_30 + R_DSPEC_LEAN_EQ_SEMANTIC -> C_49_0 + R_DSPEC_LEAN_EQ_SEMANTIC -> C_49_1 + R_DSPEC_LEAN_EQ_SEMANTIC -> C_49_2 + R_DSPEC_LEAN_EQ_SEMANTIC -> C_49_3 + R_DSPEC_LEAN_EQ_SEMANTIC -> C_49_4 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_0 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_1 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_2 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_3 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_4 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_5 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_6 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_7 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_8 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_9 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_10 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_11 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_12 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_13 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_14 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_15 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_16 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_17 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_18 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_19 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_20 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_21 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_22 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_23 + R_DSPEC_MARKDOWN_REVIEW_ARTIFACT -> C_50_24 + R_DSPEC_NIX_CI_GATE -> C_52_0 + R_DSPEC_NIX_FORMAL_TOOLS -> C_53_0 + R_DSPEC_NIX_FORMAL_TOOLS -> C_53_1 + R_DSPEC_NIX_FORMAL_TOOLS -> C_53_2 + R_DSPEC_PACKAGE_RELEASE -> C_54_0 + R_DSPEC_PACKAGE_RELEASE -> C_54_1 + R_DSPEC_PACKAGE_RELEASE -> C_54_2 + R_DSPEC_PRODUCT_POSITIONING -> C_55_0 + R_DSPEC_REAL_APP_DOGFOOD -> C_56_0 + R_DSPEC_REAL_APP_IMPORTER -> C_57_0 + R_DSPEC_REAL_APP_IMPORTER -> C_57_1 + R_DSPEC_REAL_APP_IMPORTER -> C_57_2 + R_DSPEC_REAL_APP_IMPORTER -> C_57_3 + R_DSPEC_REAL_APP_IMPORTER -> C_57_4 + R_DSPEC_REAL_APP_IMPORTER -> C_57_5 + R_DSPEC_REAL_APP_IMPORTER -> C_57_6 + R_DSPEC_REAL_APP_IMPORTER -> C_57_7 + R_DSPEC_REAL_APP_IMPORTER -> C_57_8 + R_DSPEC_REAL_APP_IMPORTER -> C_57_9 + R_DSPEC_REAL_APP_IMPORTER -> C_57_10 + R_DSPEC_REAL_APP_IMPORTER -> C_57_11 + R_DSPEC_REAL_APP_RECONCILIATION -> C_58_0 + R_DSPEC_REAL_APP_RECONCILIATION -> C_58_1 + R_DSPEC_REAL_APP_RECONCILIATION -> C_58_2 + R_DSPEC_REAL_APP_RECONCILIATION -> C_58_3 + R_DSPEC_REAL_APP_REVERSE_COVERAGE -> C_59_0 + R_DSPEC_REAL_APP_REVERSE_COVERAGE -> C_59_1 + R_DSPEC_RELEASE_SAFETY_PATTERN -> C_60_0 + R_DSPEC_RELEASE_SAFETY_PATTERN -> C_60_1 + R_DSPEC_RELEASE_SAFETY_PATTERN -> C_60_2 + R_DSPEC_RELEASE_SAFETY_PATTERN -> C_60_3 + R_DSPEC_RELEASE_SAFETY_PATTERN -> C_60_4 + R_DSPEC_RUNTIME_COLLECTOR_FIXTURE -> C_61_0 + R_DSPEC_RUNTIME_COLLECTOR_MANIFEST -> C_62_0 + R_DSPEC_RUNTIME_COLLECTOR_MANIFEST -> C_62_1 + R_DSPEC_RUNTIME_EVIDENCE_COLLECTOR -> C_63_0 + R_DSPEC_RUNTIME_EVIDENCE_COLLECTOR -> C_63_1 + R_DSPEC_RUNTIME_EVIDENCE_COLLECTOR -> C_63_2 + R_DSPEC_RUNTIME_EVIDENCE_COLLECTOR -> C_63_3 + R_DSPEC_RUNTIME_EVIDENCE_IMPORTER -> C_64_0 + R_DSPEC_RUNTIME_EVIDENCE_IMPORTER -> C_64_1 + R_DSPEC_RUNTIME_EVIDENCE_IMPORTER -> C_64_2 + R_DSPEC_RUNTIME_EVIDENCE_PATTERN -> C_65_0 + R_DSPEC_RUNTIME_EVIDENCE_PATTERN -> C_65_1 + R_DSPEC_RUNTIME_EVIDENCE_PATTERN -> C_65_2 + R_DSPEC_RUNTIME_EVIDENCE_PATTERN -> C_65_3 + R_DSPEC_RUNTIME_EVIDENCE_VERIFIER -> C_66_0 + R_DSPEC_RUNTIME_EVIDENCE_VERIFIER -> C_66_1 + R_DSPEC_RUNTIME_EVIDENCE_VERIFIER -> C_66_2 + R_DSPEC_RUNTIME_EVIDENCE_VERIFIER -> C_66_3 + R_DSPEC_RUNTIME_SAFETY_PATTERN -> C_67_0 + R_DSPEC_RUNTIME_SAFETY_PATTERN -> C_67_1 + R_DSPEC_RUNTIME_SAFETY_PATTERN -> C_67_2 + R_DSPEC_RUNTIME_SAFETY_PATTERN -> C_67_3 + R_DSPEC_RUNTIME_SAFETY_PATTERN -> C_67_4 + R_DSPEC_SCHEMA_TYPED -> C_68_0 + R_DSPEC_SOURCE_MAP_GENERATED -> C_70_0 + R_DSPEC_SOURCE_MAP_GENERATED -> C_70_1 + R_DSPEC_SPEC_CHANGE_REVIEW -> C_71_0 + R_DSPEC_SPEC_CHANGE_REVIEW -> C_71_1 + R_DSPEC_SPEC_CHANGE_REVIEW -> C_71_2 + R_DSPEC_SPEC_CHANGE_REVIEW -> C_71_3 + R_DSPEC_SPEC_CHANGE_REVIEW -> C_71_4 + R_DSPEC_SPEC_CHANGE_REVIEW -> C_71_5 + R_DSPEC_SPEC_CHANGE_REVIEW -> C_71_6 + R_DSPEC_SPEC_CHANGE_REVIEW -> C_71_7 + R_DSPEC_SPEC_CHANGE_REVIEW -> C_71_8 + R_DSPEC_SPEC_CHANGE_REVIEW -> C_71_9 + R_DSPEC_SPEC_CHANGE_REVIEW -> C_71_10 + R_DSPEC_SPEC_CHANGE_REVIEW_SCAFFOLD -> C_72_0 + R_DSPEC_SPEC_CHANGE_REVIEW_SCAFFOLD -> C_72_1 + R_DSPEC_SPEC_CHANGE_REVIEW_SCAFFOLD -> C_72_2 + R_DSPEC_SPEC_CHANGE_REVIEW_SCAFFOLD -> C_72_3 + R_DSPEC_SPEC_CHANGE_REVIEW_SCAFFOLD -> C_72_4 + R_DSPEC_SPEC_CHANGE_REVIEW_SCAFFOLD -> C_72_5 + R_DSPEC_SPEC_CHANGE_REVIEW_SCAFFOLD -> C_72_6 + R_DSPEC_SPEC_CHANGE_REVIEW_SCAFFOLD -> C_72_7 + R_DSPEC_SPEC_CHANGE_REVIEW_SCAFFOLD -> C_72_8 + R_DSPEC_SPEC_CHANGE_REVIEW_SCAFFOLD -> C_72_9 + R_DSPEC_SPEC_CHANGE_REVIEW_SCAFFOLD -> C_72_10 + R_DSPEC_SPEC_CHANGE_REVIEW_SCAFFOLD -> C_72_11 + R_DSPEC_SPEC_CHANGE_REVIEW_SCAFFOLD -> C_72_12 + R_DSPEC_SPEC_CHANGE_REVIEW_SCAFFOLD -> C_72_13 + R_DSPEC_SPEC_COMPAT_CLASSIFIER -> C_73_0 + R_DSPEC_SPEC_COMPAT_CLASSIFIER -> C_73_1 + R_DSPEC_SPEC_COMPAT_CLASSIFIER -> C_73_2 + R_DSPEC_SPEC_COMPAT_CLASSIFIER -> C_73_3 + R_DSPEC_SPEC_DIFF_IMPACT -> C_74_0 + R_DSPEC_SPEC_DIFF_IMPACT -> C_74_1 + R_DSPEC_SPEC_DIFF_IMPACT -> C_74_2 + R_DSPEC_SPEC_QUERY -> C_75_0 + R_DSPEC_SPEC_QUERY -> C_75_1 + R_DSPEC_SPEC_READING_EVAL -> C_76_0 + R_DSPEC_SPEC_READING_EVAL -> C_76_1 + R_DSPEC_SPEC_READING_EVAL -> C_76_2 + R_DSPEC_SPEC_READING_EVAL -> C_76_3 + R_DSPEC_SPEC_READING_EVAL -> C_76_4 + R_DSPEC_SPEC_READING_EVAL -> C_76_5 + R_DSPEC_SPEC_READING_EVAL -> C_76_6 + R_DSPEC_SPEC_READING_EVAL -> C_76_7 + R_DSPEC_SPEC_READING_EVAL -> C_76_8 + R_DSPEC_SPEC_READING_EVAL -> C_76_9 + R_DSPEC_SPEC_READING_EVAL -> C_76_10 + R_DSPEC_SPEC_READING_EVAL -> C_76_11 + R_DSPEC_SPEC_READING_EVAL -> C_76_12 + R_DSPEC_SPEC_READING_EVAL -> C_76_13 + R_DSPEC_SPEC_READING_EVAL -> C_76_14 + R_DSPEC_SPEC_READING_EVAL -> C_76_15 + R_DSPEC_SPEC_READING_EVAL -> C_76_16 + R_DSPEC_SPEC_READING_EVAL -> C_76_17 + R_DSPEC_SPEC_READING_EVAL -> C_76_18 + R_DSPEC_SPEC_READING_EVAL -> C_76_19 + R_DSPEC_SPEC_READING_EVAL -> C_76_20 + R_DSPEC_SPEC_READING_EVAL -> C_76_21 + R_DSPEC_SPEC_READING_EVAL -> C_76_22 + R_DSPEC_SPEC_READING_EVAL -> C_76_23 + R_DSPEC_SQL_QUERY_ORACLE -> C_77_0 + R_DSPEC_SQL_QUERY_ORACLE -> C_77_1 + R_DSPEC_STABLE_IDS -> C_78_0 + R_DSPEC_TOPLEVEL_MODEL -> C_79_0 + R_DSPEC_VERIFY_GENERATED_JSON -> C_80_0
}

assert ApprovedRulesHaveChecks {
  all r: ActiveApprovedRule | some Model.checks[r] & AutomatedCheckTarget
}

assert ActiveApprovedRulesHaveAutomatedSupport {
  all r: ActiveApprovedRule | some Model.checks[r] & AutomatedCheckTarget
}

assert DeprecatedRulesExcludedFromActive {
  no ActiveApprovedRule & DeprecatedRule
}

check ApprovedRulesHaveChecks
check ActiveApprovedRulesHaveAutomatedSupport
check DeprecatedRulesExcludedFromActive
