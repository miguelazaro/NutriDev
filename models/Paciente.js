const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Paciente = sequelize.define('Paciente', {
    nombre: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'El nombre es obligatorio'
            }
        }
    },
    genero: {
        type: DataTypes.ENUM('Masculino', 'Femenino', 'Otro'),
        allowNull: true,
    },
    fecha_nacimiento: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        validate: {
            isDate: {
                msg: 'Fecha de nacimiento inválida'
            }
        }
    },
    pais_residencia: {
        type: DataTypes.STRING,
        defaultValue: 'México',
        allowNull: true,
    },
    telefono: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            len: {
                args: [0, 20],
                msg: 'El teléfono no puede exceder los 20 caracteres'
            }
        }
    },
    enviar_cuestionario: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    lugar_consulta: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    ocupacion: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    codigo_postal: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            len: {
                args: [0, 10],
                msg: 'El código postal no puede exceder los 10 caracteres'
            }
        }
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isEmail: {
                msg: 'Debe ser un correo válido',
                args: {
                    allow_empty: true  // Permite cadenas vacías
                }
            }
        }
    },
    historial: {
        type: DataTypes.TEXT,
        allowNull: true,
    }
}, {
    tableName: 'pacientes',
    timestamps: true,
    createdAt: 'fecha_registro',
    updatedAt: 'fecha_actualizacion',
    hooks: {
        beforeCreate: (paciente) => {
            // Limpiar email si está vacío
            if (paciente.email && paciente.email.trim() === '') {
                paciente.email = null;
            }
        },
        beforeUpdate: (paciente) => {
            // Limpiar email si está vacío
            if (paciente.email && paciente.email.trim() === '') {
                paciente.email = null;
            }
        }
    }
});

module.exports = Paciente;