package com.bankadvisr.backend.controller;

import com.bankadvisr.backend.service.AuthService;
import com.bankadvisr.backend.dto.LoginRequest;
import com.bankadvisr.backend.dto.LoginResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest loginRequest) throws Exception {
        return authService.authenticateUser(loginRequest.getEmail(), loginRequest.getPassword());
    }
}
