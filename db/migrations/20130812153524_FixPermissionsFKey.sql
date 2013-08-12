
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied
ALTER TABLE permissions
	DROP CONSTRAINT permissions_group_id_fkey,
	ADD CONSTRAINT permissions_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id)
		ON UPDATE CASCADE
		ON DELETE CASCADE;

-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back
ALTER TABLE permissions
	DROP CONSTRAINT permissions_group_id_fkey,
	ADD CONSTRAINT permissions_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id);
