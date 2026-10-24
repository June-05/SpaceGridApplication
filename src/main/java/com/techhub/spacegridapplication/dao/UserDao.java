package com.techhub.spacegridapplication.dao;

import com.techhub.spacegridapplication.model.User;
import java.util.Optional;

public interface UserDao extends CrudDao<User> {

Optional<User> findByUsername(String username);

boolean existsByUsername(String username);
}
