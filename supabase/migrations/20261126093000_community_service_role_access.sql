begin;
grant usage on schema fca_private to service_role;
grant all on fca_private.community_review_samples, fca_private.community_ingest_limits, fca_private.community_ingest_state to service_role;
commit;
