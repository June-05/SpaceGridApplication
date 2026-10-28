package com.techhub.spacegridapplication.dao;

import com.techhub.spacegridapplication.model.User;

import java.util.List;
import java.util.Optional;

public interface UserDao extends CrudDao<User> {

    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);

    /** RENTER accounts whose username or full name contains the text (at most 20), for the lease form. */
    List<User> findRenters(String search);
}
