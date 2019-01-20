
CREATE TABLE users
(
  id serial NOT NULL,
  username character varying(64),
  password character varying(255),
  CONSTRAINT userspk PRIMARY KEY (id)
);

CREATE TABLE categories
(
  id serial NOT NULL,
  title character varying(120),
  CONSTRAINT categoriespk PRIMARY KEY (id)
);

CREATE TABLE posts
(
  id serial NOT NULL,
  users_id bigint,
  title character varying(120),
  body text,
  categories_id bigint,
  CONSTRAINT postspk PRIMARY KEY (id),
  CONSTRAINT postscategoriesfk FOREIGN KEY (categories_id)
      REFERENCES categories (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT postsusersfk FOREIGN KEY (users_id)
      REFERENCES users (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
);
